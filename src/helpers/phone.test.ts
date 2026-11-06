import { describe, expect, it } from "vitest";

import {
  caretAfterDigits,
  editPhone,
  formatPhone,
  isAcceptablePhone,
  isValidPhone,
  phoneDigits,
} from "./phone";

describe("formatPhone", () => {
  it("formats a landline with 10 digits", () => {
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it("formats a mobile with 11 digits", () => {
    expect(formatPhone("11999998888")).toBe("(11) 99999-8888");
  });

  it("formats while typing", () => {
    expect(formatPhone("1")).toBe("(1");
    expect(formatPhone("119")).toBe("(11) 9");
    expect(formatPhone("1199999")).toBe("(11) 9999-9");
  });

  it("formats an already formatted number and ignores extra digits", () => {
    expect(formatPhone("(11) 3333-4444")).toBe("(11) 3333-4444");
    expect(formatPhone("119999988887")).toBe("(11) 99999-8888");
  });

  it("is empty without digits", () => {
    expect(formatPhone("")).toBe("");
  });
});

describe("phoneDigits", () => {
  it("keeps only the digits", () => {
    expect(phoneDigits("(11) 3333-4444")).toBe("1133334444");
  });

  it("drops the country code of a pasted number", () => {
    expect(phoneDigits("+55 11 98765-4321")).toBe("11987654321");
    expect(phoneDigits("+55 (11) 3333-4444")).toBe("1133334444");
  });

  it("keeps an area code 55 that is not a country code", () => {
    expect(phoneDigits("(55) 99999-9999")).toBe("55999999999");
  });
});

describe("isAcceptablePhone", () => {
  it("accepts a valid number or the incomplete one already saved", () => {
    expect(isAcceptablePhone("1133334444")).toBe(true);
    expect(isAcceptablePhone("1199", "1199")).toBe(true);
    expect(isAcceptablePhone("1198", "1199")).toBe(false);
    expect(isAcceptablePhone("119")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("accepts landlines and mobiles only", () => {
    expect(isValidPhone("1133334444")).toBe(true);
    expect(isValidPhone("(11) 99999-8888")).toBe(true);
    expect(isValidPhone("119")).toBe(false);
  });
});

describe("editPhone", () => {
  it("strips the country code of a paste over a selected full number", () => {
    expect(
      editPhone("(11) 99999-9999", "+55 11 3456-7890", 16, {
        hadSelection: true,
      }).digits,
    ).toBe("1134567890");
  });

  it("doesn't take an area code 55 for a country code when typing", () => {
    expect(editPhone("(55) 99999-9999", "(55) 99999-99991", 16).digits).toBe(
      "55999999999",
    );
  });

  it("erases the digit before a separator erased with backspace", () => {
    // "(11) 3333-|4444" → backspace removes the "-"
    expect(editPhone("(11) 3333-4444", "(11) 33334444", 9)).toEqual({
      digits: "113334444",
      digitsBeforeCaret: 5,
    });
  });

  it("erases the digit after a separator erased with delete", () => {
    // "(11) 3333|-4444" → delete removes the "-"
    expect(
      editPhone("(11) 3333-4444", "(11) 33334444", 9, {
        erasingForward: true,
      }),
    ).toEqual({
      digits: "113333444",
      digitsBeforeCaret: 6,
    });
  });

  it("keeps the cursor after a digit typed in the middle", () => {
    // "(11) 33|33-4444" → types "5"
    expect(editPhone("(11) 3333-4444", "(11) 33533-4444", 8)).toEqual({
      digits: "11335334444",
      digitsBeforeCaret: 5,
    });
  });
});

describe("editPhone with a selection", () => {
  it("doesn't take a digit along when a selection held only separators", () => {
    // ") " selected in "(11) 3333-4444" and erased
    expect(
      editPhone("(11) 3333-4444", "(113333-4444", 3, { hadSelection: true }),
    ).toEqual({
      digits: "1133334444",
      digitsBeforeCaret: 2,
    });
  });
});

describe("editPhone with only the hyphen selected", () => {
  it("erases the hyphen and keeps every digit", () => {
    expect(
      editPhone("(11) 3333-4444", "(11) 33334444", 9, { hadSelection: true }),
    ).toEqual({ digits: "1133334444", digitsBeforeCaret: 6 });
  });
});

describe("caretAfterDigits", () => {
  it("puts the cursor right after the nth digit", () => {
    expect(caretAfterDigits("(11) 33533-4444", 5)).toBe(8);
    expect(caretAfterDigits("(11) 3333-4444", 6)).toBe(9);
    expect(caretAfterDigits("(11) 3333-4444", 0)).toBe(1);
  });
});
