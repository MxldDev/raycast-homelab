import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Icon,
  Keyboard,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { fetchError } from "./fetch-error";
import {
  COST_TYPES,
  currency,
  deleteRecord,
  distanceUnit,
  hasLubelogger,
  listRecords,
  listReminders,
  loadVehicleInfo,
  LUBELOGGER_URL,
  RECORD_KINDS,
  RecordType,
  Reminder,
  VehicleInfo,
  VehicleRecord,
  vehicleWebUrl,
  volumeUnit,
} from "./lubelogger-api";
import NotConfigured from "./not-configured";
import AddVehicleRecord from "./vehicle-add";

const TYPE_STYLE: Record<RecordType, { icon: Icon; color: Color }> = {
  gas: { icon: Icon.Raindrop, color: Color.Blue },
  service: { icon: Icon.WrenchScrewdriver, color: Color.Green },
  repair: { icon: Icon.Hammer, color: Color.Orange },
  upgrade: { icon: Icon.Stars, color: Color.Purple },
  tax: { icon: Icon.Receipt, color: Color.Yellow },
  odometer: { icon: Icon.Gauge, color: Color.SecondaryText },
};

function money(value: number): string {
  const unit = currency();
  const rounded =
    Math.abs(value) >= 100
      ? Math.round(value).toLocaleString()
      : value.toFixed(2).replace(/\.00$/, "");
  return unit ? `${rounded} ${unit}` : rounded;
}

function dateLabel(record: VehicleRecord): string {
  if (!record.date) return record.dateText;
  return record.date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function yearOf(record: VehicleRecord): string {
  return record.date ? String(record.date.getUTCFullYear()) : "Undated";
}

export default function Vehicle() {
  const [filter, setFilter] = useState<"all" | RecordType>("all");

  const infos = useCachedPromise(
    async (signal?: AbortSignal) => loadVehicleInfo(signal),
    [],
    { keepPreviousData: true, onError: fetchError("LubeLogger") },
  );

  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const info: VehicleInfo | undefined =
    infos.data?.find((entry) => entry.vehicle.id === vehicleId) ?? infos.data?.[0];

  const records = useCachedPromise(
    async (id: number | undefined): Promise<VehicleRecord[]> =>
      id ? listRecords(id, Object.keys(RECORD_KINDS) as RecordType[]) : [],
    [info?.vehicle.id],
    { keepPreviousData: true, onError: fetchError("LubeLogger") },
  );

  const reminders = useCachedPromise(
    async (id: number | undefined): Promise<Reminder[]> =>
      id ? listReminders(id) : [],
    [info?.vehicle.id],
    { keepPreviousData: true, onError: fetchError("LubeLogger", { silent: true }) },
  );

  if (!hasLubelogger())
    return <NotConfigured service="LubeLogger" needs="URL" />;

  const all = records.data ?? [];
  const shown = filter === "all" ? all : all.filter((r) => r.type === filter);
  const thisYear = new Date().getFullYear();
  const ytd = all
    .filter(
      (r) =>
        COST_TYPES.includes(r.type) && r.date?.getUTCFullYear() === thisYear,
    )
    .reduce((sum, r) => sum + r.cost, 0);
  const ytdCount = all.filter(
    (r) => COST_TYPES.includes(r.type) && r.date?.getUTCFullYear() === thisYear,
  ).length;

  const years = [...new Set(shown.map(yearOf))];

  function refresh() {
    infos.revalidate();
    records.revalidate();
    reminders.revalidate();
  }

  async function remove(record: VehicleRecord) {
    const confirmed = await confirmAlert({
      title: `Delete this ${RECORD_KINDS[record.type].label.toLowerCase()} record?`,
      message: `${record.description || dateLabel(record)} — ${money(record.cost)}. This removes it from LubeLogger permanently.${
        record.odometer
          ? " LubeLogger keeps the odometer reading it mirrored from this record."
          : ""
      }`,
      icon: Icon.Trash,
      primaryAction: {
        title: "Delete Record",
        style: Alert.ActionStyle.Destructive,
      },
    });
    if (!confirmed) return;
    try {
      await deleteRecord(record.type, record.id);
      await showToast({ style: Toast.Style.Success, title: "Record deleted" });
      refresh();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not delete the record",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function recordActions(record?: VehicleRecord) {
    return (
      <ActionPanel>
        {info && (
          <Action.Push
            title="Add Record"
            icon={Icon.Plus}
            shortcut={Keyboard.Shortcut.Common.New}
            target={
              <AddVehicleRecord
                vehicles={(infos.data ?? []).map((entry) => entry.vehicle)}
                vehicleId={info.vehicle.id}
                lastOdometer={info.odometer}
                defaultType={filter === "all" ? "gas" : filter}
                onAdded={refresh}
              />
            }
          />
        )}
        {info && (
          <Action.OpenInBrowser
            title="Open in Lubelogger"
            icon={Icon.Car}
            url={vehicleWebUrl(info.vehicle.id)}
          />
        )}
        {record && (
          <Action.CopyToClipboard
            title="Copy Record"
            content={`${dateLabel(record)} — ${record.description} — ${money(record.cost)}`}
          />
        )}
        {(infos.data?.length ?? 0) > 1 && (
          <ActionPanel.Submenu
            title="Switch Vehicle"
            icon={Icon.Switch}
                      >
            {(infos.data ?? []).map((entry) => (
              <Action
                key={entry.vehicle.id}
                title={entry.name}
                icon={Icon.Car}
                onAction={() => setVehicleId(entry.vehicle.id)}
              />
            ))}
          </ActionPanel.Submenu>
        )}
        <Action
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={Keyboard.Shortcut.Common.Refresh}
          onAction={refresh}
        />
        {record && (
          <Action
            title="Delete Record"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={Keyboard.Shortcut.Common.Remove}
            onAction={() => remove(record)}
          />
        )}
        <Action
          title="Configure Extension"
          icon={Icon.Gear}
          onAction={openExtensionPreferences}
        />
      </ActionPanel>
    );
  }

  return (
    <List
      isLoading={infos.isLoading || records.isLoading}
      navigationTitle={info ? `${info.name} — LubeLogger` : "LubeLogger"}
      searchBarPlaceholder="Search fuel-ups, service, repairs and expenses…"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Record type"
          value={filter}
          onChange={(value) => setFilter(value as "all" | RecordType)}
        >
          <List.Dropdown.Item value="all" title="All records" />
          {(Object.keys(RECORD_KINDS) as RecordType[]).map((type) => (
            <List.Dropdown.Item
              key={type}
              value={type}
              title={RECORD_KINDS[type].plural}
            />
          ))}
        </List.Dropdown>
      }
    >
      {info && (
        <List.Section title={`${info.name}${info.vehicle.licensePlate ? ` · ${info.vehicle.licensePlate}` : ""}`}>
          <List.Item
            icon={{ source: Icon.Gauge, tintColor: Color.Blue }}
            title="Odometer"
            subtitle={`${Math.round(info.odometer).toLocaleString()} ${distanceUnit()}`}
            accessories={[
              {
                tag: info.vehicle.isElectric
                  ? "Electric"
                  : info.vehicle.isDiesel
                    ? "Diesel"
                    : "Petrol",
              },
            ]}
            actions={recordActions()}
          />
          <List.Item
            icon={{ source: Icon.Coins, tintColor: Color.Yellow }}
            title={`Spent in ${thisYear}`}
            subtitle={`${money(ytd)} across ${ytdCount} record${ytdCount === 1 ? "" : "s"}`}
            accessories={[{ text: `all time ${money(info.totalCost)}` }]}
            actions={recordActions()}
          />
          <List.Item
            icon={{ source: Icon.PieChart, tintColor: Color.SecondaryText }}
            title="Breakdown"
            subtitle={COST_TYPES.filter((type) => info.costs[type] > 0)
              .map(
                (type) =>
                  `${RECORD_KINDS[type].plural.toLowerCase()} ${money(info.costs[type])}`,
              )
              .join(" · ")}
            actions={recordActions()}
          />
          {(reminders.data ?? []).map((reminder) => (
            <List.Item
              key={reminder.id}
              icon={{
                source: Icon.Bell,
                tintColor: /urgent|pastdue/i.test(reminder.urgency)
                  ? Color.Red
                  : Color.Orange,
              }}
              title={reminder.description}
              subtitle={
                reminder.metric === "Odometer"
                  ? `due at ${reminder.dueOdometer.toLocaleString()} ${distanceUnit()}`
                  : `due ${reminder.dueDate}`
              }
              accessories={[
                {
                  tag: {
                    value: reminder.urgency.replace(/([a-z])([A-Z])/g, "$1 $2"),
                    color: /urgent|pastdue/i.test(reminder.urgency)
                      ? Color.Red
                      : Color.Orange,
                  },
                },
              ]}
              actions={recordActions()}
            />
          ))}
        </List.Section>
      )}

      {years.map((year) => (
        <List.Section
          key={year}
          title={year}
          subtitle={money(
            shown
              .filter((r) => yearOf(r) === year && COST_TYPES.includes(r.type))
              .reduce((sum, r) => sum + r.cost, 0),
          )}
        >
          {shown
            .filter((r) => yearOf(r) === year)
            .map((record) => (
              <List.Item
                key={`${record.type}-${record.id}`}
                icon={{
                  source: TYPE_STYLE[record.type].icon,
                  tintColor: TYPE_STYLE[record.type].color,
                }}
                title={record.description || RECORD_KINDS[record.type].label}
                subtitle={[
                  dateLabel(record),
                  record.odometer
                    ? `${Math.round(record.odometer).toLocaleString()} ${distanceUnit()}`
                    : undefined,
                  record.type === "gas" && record.fuelConsumed
                    ? `${record.fuelConsumed} ${volumeUnit()}`
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                keywords={[
                  RECORD_KINDS[record.type].label,
                  ...record.tags,
                  ...(record.notes ? [record.notes] : []),
                ]}
                accessories={[
                  ...(record.tags.length
                    ? [{ tag: record.tags.join(", ") }]
                    : []),
                  {
                    tag: {
                      value: RECORD_KINDS[record.type].label,
                      color: TYPE_STYLE[record.type].color,
                    },
                  },
                  ...(COST_TYPES.includes(record.type)
                    ? [{ text: money(record.cost) }]
                    : []),
                ]}
                actions={recordActions(record)}
              />
            ))}
        </List.Section>
      ))}

      <List.EmptyView
        icon={Icon.Car}
        title={
          records.isLoading ? "Loading vehicle records…" : "No records yet"
        }
        description={
          LUBELOGGER_URL
            ? "Press ⌘N to log a fuel-up, service, repair or expense."
            : undefined
        }
        actions={recordActions()}
      />
    </List>
  );
}
