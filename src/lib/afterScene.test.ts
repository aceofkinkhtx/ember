import { dueNow, type Reminder } from "./afterScene";

// Home's check-ins card crashed on a proposal alert (Nov 17): only check-ins belong there.

const r = (
  kind: Reminder["kind"],
  patch: Partial<Reminder> = {},
): Reminder => ({
  id: kind,
  vibeId: "v1",
  kind,
  day: 0,
  dueAt: "2026-11-01T00:00:00Z",
  doneAt: null,
  ...patch,
});

describe("check-ins due now", () => {
  it("leaves out message and proposal alerts", () => {
    const all = [r("post"), r("checkin"), r("message"), r("negotiation")];
    expect(dueNow(all).map((x) => x.kind)).toEqual(["post", "checkin"]);
  });

  it("leaves out ones that are done or not due yet", () => {
    expect(
      dueNow([
        r("debrief", { doneAt: "2026-11-02T00:00:00Z" }),
        r("followup", { dueAt: "2999-01-01T00:00:00Z" }),
      ]),
    ).toEqual([]);
  });
});
