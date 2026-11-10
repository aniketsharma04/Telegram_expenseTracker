import { describe, expect, it } from "vitest";
import { parseUpiResult } from "./upi";

describe("parseUpiResult", () => {
  it("reads the NPCI response string in the 'response' extra", () => {
    expect(
      parseUpiResult({
        resultCode: -1,
        extra: {
          response: "txnId=AX1&responseCode=00&Status=SUCCESS&txnRef=r1",
        },
      }),
    ).toBe("success");
    expect(
      parseUpiResult({
        resultCode: -1,
        extra: { response: "txnId=AX1&responseCode=ZD&Status=FAILURE" },
      }),
    ).toBe("failure");
    expect(
      parseUpiResult({
        resultCode: -1,
        extra: { response: "Status=SUBMITTED&txnId=1" },
      }),
    ).toBe("pending");
  });

  it("copes with apps that use other keys, cases or the data URI", () => {
    expect(parseUpiResult({ extra: { Status: "success" } })).toBe("success");
    expect(parseUpiResult({ extra: { status: "Failure" } })).toBe("failure");
    expect(
      parseUpiResult({ data: "upi://response?txnId=1&Status=SUCCESS" }),
    ).toBe("success");
    expect(parseUpiResult({ extra: { response: "responseCode=00" } })).toBe(
      "success",
    );
    expect(parseUpiResult({ extra: { response: "responseCode=U30" } })).toBe(
      "failure",
    );
  });

  it("says unknown rather than guessing", () => {
    expect(parseUpiResult(null)).toBe("unknown");
    expect(parseUpiResult({ resultCode: 0 })).toBe("unknown"); // back button, no data
    expect(parseUpiResult({ resultCode: -1, extra: {} })).toBe("unknown");
    expect(parseUpiResult({ extra: { response: "something odd" } })).toBe(
      "unknown",
    );
    expect(parseUpiResult({ extra: { response: "Status=%E0%A4" } })).toBe(
      "unknown",
    ); // bad encoding
    expect(
      parseUpiResult({ extra: { response: "%E0%A4=x&Status=SUCCESS" } }),
    ).toBe("success"); // a bad key doesn't break the rest
  });
});
