import {
  Action,
  ActionPanel,
  Form,
  Icon,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import {
  addRecord,
  currency,
  distanceUnit,
  RECORD_KINDS,
  RecordType,
  Vehicle,
  vehicleName,
  volumeUnit,
} from "./lubelogger-api";

interface Props {
  vehicles: Vehicle[];
  vehicleId: number;
  /** Pre-fills the odometer field so a fuel-up needs one number changed, not two. */
  lastOdometer?: number;
  defaultType?: RecordType;
  onAdded?: () => void;
}

const ORDER: RecordType[] = [
  "gas",
  "service",
  "repair",
  "tax",
  "upgrade",
  "odometer",
];

export default function AddVehicleRecord({
  vehicles,
  vehicleId,
  lastOdometer,
  defaultType = "gas",
  onAdded,
}: Props) {
  const { pop } = useNavigation();
  const [type, setType] = useState<RecordType>(defaultType);
  const [vehicle, setVehicle] = useState(String(vehicleId));
  const [odometer, setOdometer] = useState(
    lastOdometer ? String(Math.round(lastOdometer)) : "",
  );
  const [cost, setCost] = useState("");
  const [fuel, setFuel] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());
  const [fillToFull, setFillToFull] = useState(true);
  const [missedFuelUp, setMissedFuelUp] = useState(false);
  const [saving, setSaving] = useState(false);

  const needsOdometer = type !== "tax";
  const needsCost = type !== "odometer";
  const needsDescription = !["gas", "odometer"].includes(type);

  function amount(raw: string): number | null {
    const value = Number(raw.trim().replace(",", "."));
    return Number.isFinite(value) ? value : null;
  }

  async function submit() {
    const parsedCost = needsCost ? amount(cost) : 0;
    const parsedOdometer = needsOdometer ? amount(odometer) : 0;
    const parsedFuel = type === "gas" ? amount(fuel) : 0;

    if (!date) return fail("Pick a date");
    if (needsCost && (parsedCost === null || parsedCost < 0))
      return fail("Enter a cost, e.g. 42.50");
    if (needsOdometer && (parsedOdometer === null || parsedOdometer <= 0))
      return fail(`Enter the odometer reading in ${distanceUnit()}`);
    if (type === "gas" && (parsedFuel === null || parsedFuel <= 0))
      return fail(`Enter how much fuel went in, in ${volumeUnit()}`);
    if (needsDescription && !description.trim())
      return fail("Describe what this was for");

    setSaving(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Adding ${RECORD_KINDS[type].label.toLowerCase()} record…`,
    });
    try {
      const stored = await addRecord({
        type,
        vehicleId: Number(vehicle),
        date,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        cost: parsedCost ?? 0,
        odometer: parsedOdometer ?? 0,
        fuelConsumed: parsedFuel ?? 0,
        isFillToFull: fillToFull,
        missedFuelUp,
      });
      toast.style = Toast.Style.Success;
      toast.title = `${RECORD_KINDS[type].label} record added`;
      toast.message = [
        stored.cost ? `${stored.cost} ${currency()}`.trim() : undefined,
        type === "gas" && stored.fuelConsumed
          ? `${stored.fuelConsumed} ${volumeUnit()}`
          : undefined,
        stored.odometer ? `at ${stored.odometer} ${distanceUnit()}` : undefined,
      ]
        .filter(Boolean)
        .join(" · ");
      onAdded?.();
      pop();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not add the record";
      toast.message = error instanceof Error ? error.message : String(error);
    } finally {
      setSaving(false);
    }
  }

  async function fail(message: string) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Missing detail",
      message,
    });
  }

  return (
    <Form
      isLoading={saving}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Record" icon={Icon.Plus} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="type"
        title="Type"
        value={type}
        onChange={(value) => setType(value as RecordType)}
      >
        {ORDER.map((kind) => (
          <Form.Dropdown.Item
            key={kind}
            value={kind}
            title={RECORD_KINDS[kind].label}
          />
        ))}
      </Form.Dropdown>

      {vehicles.length > 1 && (
        <Form.Dropdown
          id="vehicle"
          title="Vehicle"
          value={vehicle}
          onChange={setVehicle}
        >
          {vehicles.map((v) => (
            <Form.Dropdown.Item
              key={v.id}
              value={String(v.id)}
              title={vehicleName(v)}
            />
          ))}
        </Form.Dropdown>
      )}

      <Form.DatePicker
        id="date"
        title="Date"
        type={Form.DatePicker.Type.Date}
        value={date}
        onChange={setDate}
      />

      {needsDescription && (
        <Form.TextField
          id="description"
          title="Description"
          placeholder={
            type === "tax" ? "Registration, car wash, insurance…" : "What was done"
          }
          value={description}
          onChange={setDescription}
        />
      )}

      {needsCost && (
        <Form.TextField
          id="cost"
          title={`Cost${currency() ? ` (${currency()})` : ""}`}
          placeholder="42.50"
          value={cost}
          onChange={setCost}
        />
      )}

      {type === "gas" && (
        <Form.TextField
          id="fuel"
          title={`Fuel (${volumeUnit()})`}
          placeholder="40.5"
          value={fuel}
          onChange={setFuel}
        />
      )}

      {needsOdometer && (
        <Form.TextField
          id="odometer"
          title={`Odometer (${distanceUnit()})`}
          placeholder="255460"
          value={odometer}
          onChange={setOdometer}
        />
      )}

      {type === "gas" && (
        <>
          <Form.Checkbox
            id="fillToFull"
            label="Filled the tank to full"
            value={fillToFull}
            onChange={setFillToFull}
          />
          <Form.Checkbox
            id="missedFuelUp"
            label="A fuel-up before this one was not logged"
            value={missedFuelUp}
            onChange={setMissedFuelUp}
          />
        </>
      )}

      <Form.TextArea
        id="notes"
        title="Notes"
        placeholder="Optional"
        value={notes}
        onChange={setNotes}
      />
    </Form>
  );
}
