import { describe, expect, it } from "vitest";
import { formatCompact, formatDeltaPct, formatDuration, formatHours } from "@/lib/format";

describe("format angka Indonesia", () => {
  it("pembulatan konsisten rb/jt", () => {
    expect(formatCompact(1234)).toBe("1,2rb");
    expect(formatCompact(3_400_000)).toBe("3,4jt");
    expect(formatCompact(950)).toBe("950");
    expect(formatCompact(-1500)).toBe("-1,5rb");
    expect(formatCompact(null)).toBe("-");
  });
  it("watch time jam 1 desimal", () => {
    expect(formatHours(38450.5)).toBe("38.450,5 jam");
    expect(formatHours(2)).toBe("2,0 jam");
  });
  it("delta persen", () => {
    expect(formatDeltaPct(12.4)).toBe("+12,4%");
    expect(formatDeltaPct(-3.1)).toBe("-3,1%");
    expect(formatDeltaPct(null)).toBe("N/A");
  });
  it("durasi", () => {
    expect(formatDuration(620)).toBe("10:20");
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});
