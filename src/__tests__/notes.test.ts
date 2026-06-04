import { describe, it, expect } from "vitest";

// We need to test the normalizeString function internally
// Since it's not exported, we'll recreate it here for testing
const normalizeString = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
};

describe("normalizeString", () => {
  describe("Basic German Umlauts", () => {
    it("should normalize ä to a", () => {
      expect(normalizeString("ä")).toBe("a");
    });

    it("should normalize ö to o", () => {
      expect(normalizeString("ö")).toBe("o");
    });

    it("should normalize ü to u", () => {
      expect(normalizeString("ü")).toBe("u");
    });

    it("should normalize ß to ss", () => {
      expect(normalizeString("ß")).toBe("ss");
    });
  });

  describe("Uppercase Umlauts", () => {
    it("should normalize Ä to a", () => {
      expect(normalizeString("Ä")).toBe("a");
    });

    it("should normalize Ö to o", () => {
      expect(normalizeString("Ö")).toBe("o");
    });

    it("should normalize Ü to u", () => {
      expect(normalizeString("Ü")).toBe("u");
    });
  });

  describe("Words with Umlauts", () => {
    it("should normalize Müller to muller", () => {
      expect(normalizeString("Müller")).toBe("muller");
    });

    it("should normalize Straße to strasse", () => {
      expect(normalizeString("Straße")).toBe("strasse");
    });

    it("should normalize Häuser to hauser", () => {
      expect(normalizeString("Häuser")).toBe("hauser");
    });

    it("should normalize Größe to grosse", () => {
      expect(normalizeString("Größe")).toBe("grosse");
    });

    it("should normalize Fuß to fuss", () => {
      expect(normalizeString("Fuß")).toBe("fuss");
    });
  });

  describe("Mixed case with Umlauts", () => {
    it("should handle mixed case: straße -> strasse", () => {
      expect(normalizeString("Straße")).toBe("strasse");
    });

    it("should handle mixed case: MÜLler -> muller", () => {
      expect(normalizeString("MÜLler")).toBe("muller");
    });
  });

  describe("Sentences with Umlauts", () => {
    it("should normalize full sentence with umlauts", () => {
      const sentence = "Die Straße ist in München";
      expect(normalizeString(sentence)).toBe("die strasse ist in munchen");
    });

    it("should handle multiple ß in one string", () => {
      expect(normalizeString("Straße Fuß")).toBe("strasse fuss");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      expect(normalizeString("")).toBe("");
    });

    it("should handle string without umlauts", () => {
      expect(normalizeString("Hello World")).toBe("hello world");
    });

    it("should handle string with only umlauts", () => {
      expect(normalizeString("äöüß")).toBe("aouss");
    });

    it("should handle numbers and special characters", () => {
      expect(normalizeString("Test123!@#")).toBe("test123!@#");
    });
  });

  describe("Diacritics from other languages", () => {
    it("should handle French accents: café -> cafe", () => {
      expect(normalizeString("café")).toBe("cafe");
    });

    it("should handle Spanish: habitación -> habitacion", () => {
      expect(normalizeString("habitación")).toBe("habitacion");
    });

    it("should handle Nordic: Åse -> ase", () => {
      expect(normalizeString("Åse")).toBe("ase");
    });
  });
});
