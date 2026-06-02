const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateBatteryRebate,
  calculateNswVppIncentive,
  calculateTaperedCapacity,
  calculateWaRebate,
  estimateNominalCapacity,
  restoreSettings,
  saveSettings,
  STORAGE_KEY
} = require("./app.js");

function baseInput(overrides = {}) {
  return {
    usableCapacity: 10,
    nominalCapacity: 10,
    state: "WA",
    solarSize: 6.6,
    installDate: "2026-06-02",
    stcPrice: 40,
    ...overrides
  };
}

test("calculates 10 kWh usable capacity at the 2026 May-Dec factor", () => {
  const result = calculateBatteryRebate(baseInput({ usableCapacity: 10, nominalCapacity: 10 }));

  assert.equal(result.factor, 6.8);
  assert.equal(result.stcs, 68);
  assert.equal(result.discount, 2720);
});

test("calculates capacity crossing the 14 kWh taper boundary", () => {
  const result = calculateBatteryRebate(baseInput({ usableCapacity: 20, nominalCapacity: 20 }));

  assert.equal(result.taper.firstBand, 14);
  assert.equal(result.taper.secondBand, 6);
  assert.equal(result.stcs, 119);
});

test("calculates capacity crossing all taper bands", () => {
  const result = calculateBatteryRebate(baseInput({ usableCapacity: 40, nominalCapacity: 40 }));

  assert.equal(result.taper.firstBand, 14);
  assert.equal(result.taper.secondBand, 14);
  assert.equal(result.taper.thirdBand, 12);
  assert.equal(result.stcs, 164);
});

test("caps counted usable capacity at 50 kWh", () => {
  const result = calculateBatteryRebate(baseInput({ usableCapacity: 60, nominalCapacity: 60 }));

  assert.equal(result.taper.countedCapacity, 50);
  assert.equal(result.stcs, 174);
  assert.ok(result.messages.some((message) => message.text.includes("first 50 kWh")));
});

test("rounds partial STCs down", () => {
  const result = calculateBatteryRebate(baseInput({ usableCapacity: 14.1, nominalCapacity: 14.1 }));

  assert.equal(result.rawStcs, 95.608);
  assert.equal(result.stcs, 95);
});

test("fails nominal capacity below 5 kWh", () => {
  const result = calculateBatteryRebate(baseInput({ nominalCapacity: 4 }));

  assert.equal(result.isEligibleEstimate, false);
  assert.equal(result.stcs, 0);
  assert.ok(result.messages.some((message) => message.type === "error" && message.text.includes("at least 5 kWh")));
});

test("fails nominal capacity above 100 kWh", () => {
  const result = calculateBatteryRebate(baseInput({ nominalCapacity: 101 }));

  assert.equal(result.isEligibleEstimate, false);
  assert.equal(result.stcs, 0);
  assert.ok(result.messages.some((message) => message.type === "error" && message.text.includes("must not exceed 100 kWh")));
});

test("fails solar size of 0 kW", () => {
  const result = calculateBatteryRebate(baseInput({ solarSize: 0 }));

  assert.equal(result.isEligibleEstimate, false);
  assert.equal(result.stcs, 0);
  assert.ok(result.messages.some((message) => message.type === "error" && message.text.includes("without solar PV")));
});

test("fails solar size of 100 kW or more", () => {
  const result = calculateBatteryRebate(baseInput({ solarSize: 100 }));

  assert.equal(result.isEligibleEstimate, false);
  assert.equal(result.stcs, 0);
  assert.ok(result.messages.some((message) => message.type === "error" && message.text.includes("less than 100 kW")));
});

test("fails dates before the program start", () => {
  const result = calculateBatteryRebate(baseInput({ installDate: "2025-06-30" }));

  assert.equal(result.isEligibleEstimate, false);
  assert.equal(result.stcs, 0);
  assert.ok(result.messages.some((message) => message.type === "error" && message.text.includes("1 July 2025")));
});

test("taper helper returns weighted capacity", () => {
  assert.deepEqual(calculateTaperedCapacity(50), {
    countedCapacity: 50,
    firstBand: 14,
    secondBand: 14,
    thirdBand: 22,
    weightedCapacity: 25.7
  });
});

test("estimates nominal capacity from usable capacity", () => {
  assert.equal(estimateNominalCapacity(13.5), 15);
  assert.equal(estimateNominalCapacity(20), 22.2);
  assert.equal(estimateNominalCapacity(0), 0);
});

test("calculates WA Synergy state rebate and combined estimate", () => {
  const result = calculateBatteryRebate(baseInput({ usableCapacity: 13.5, nominalCapacity: 15, state: "WA", waProvider: "synergy" }));

  assert.equal(result.discount, 3640);
  assert.equal(result.stateRebate, 1300);
  assert.equal(result.totalDiscount, 4940);
  assert.equal(result.stateRebateDetails.provider, "Synergy");
});

test("calculates WA Horizon Power state rebate and cap", () => {
  const result = calculateBatteryRebate(baseInput({ usableCapacity: 13.5, nominalCapacity: 15, state: "WA", waProvider: "horizon" }));

  assert.equal(result.stateRebate, 3800);
  assert.equal(result.totalDiscount, 7440);
  assert.equal(result.stateRebateDetails.provider, "Horizon Power");
});

test("does not calculate state rebate outside WA", () => {
  const result = calculateBatteryRebate(baseInput({ state: "NSW" }));

  assert.equal(result.stateRebate, 0);
  assert.equal(result.totalDiscount, result.discount);
  assert.equal(result.stateRebateDetails.rebate, 0);
});

test("WA rebate helper caps usable capacity at 10 kWh", () => {
  assert.deepEqual(calculateWaRebate(20, "synergy"), {
    provider: "Synergy",
    rate: 130,
    cap: 1300,
    countedCapacity: 10,
    rebate: 1300
  });
});

test("calculates NSW VPP incentive only when opted in", () => {
  const excluded = calculateBatteryRebate(baseInput({ state: "NSW", includeNswVpp: false }));
  const included = calculateBatteryRebate(baseInput({ usableCapacity: 13.5, nominalCapacity: 15, state: "NSW", includeNswVpp: true }));

  assert.equal(excluded.stateRebate, 0);
  assert.equal(excluded.totalDiscount, excluded.discount);
  assert.equal(included.stateRebate, 742.5);
  assert.equal(included.totalDiscount, 4382.5);
});

test("caps NSW VPP incentive and excludes batteries outside capacity range", () => {
  assert.equal(calculateNswVppIncentive(28, true).rebate, 1500);
  assert.equal(calculateNswVppIncentive(29, true).rebate, 0);
  assert.equal(calculateNswVppIncentive(1.9, true).rebate, 0);
  assert.equal(calculateNswVppIncentive(13.5, false).rebate, 0);
});

test("does not calculate closed or non-calculable jurisdiction programs", () => {
  ["ACT", "NT", "QLD", "SA", "TAS", "VIC"].forEach((state) => {
    const result = calculateBatteryRebate(baseInput({ state }));
    assert.equal(result.stateRebate, 0);
    assert.equal(result.totalDiscount, result.discount);
  });
});

test("saves calculator settings to browser storage", () => {
  const originalWindow = global.window;
  const storage = new Map();
  global.window = {
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    }
  };

  try {
    saveSettings({
      elements: {
        usableCapacity: { type: "number", value: "20" },
        state: { type: "select-one", value: "NSW" },
        solarSize: { type: "number", value: "10" },
        waProvider: { type: "select-one", value: "horizon" },
        includeNswVpp: { type: "checkbox", checked: true },
        installDate: { type: "date", value: "2026-07-01" },
        autoNominal: { type: "checkbox", checked: false },
        nominalCapacity: { type: "number", value: "22" },
        stcPrice: { type: "number", value: "38.50" }
      }
    });

    assert.deepEqual(JSON.parse(storage.get(STORAGE_KEY)), {
      usableCapacity: "20",
      state: "NSW",
      solarSize: "10",
      waProvider: "horizon",
      includeNswVpp: true,
      installDate: "2026-07-01",
      autoNominal: false,
      nominalCapacity: "22",
      stcPrice: "38.50"
    });
  } finally {
    global.window = originalWindow;
  }
});

test("restores calculator settings from browser storage", () => {
  const originalWindow = global.window;
  global.window = {
    localStorage: {
      getItem: () => JSON.stringify({
        usableCapacity: "18",
        state: "WA",
        includeNswVpp: true,
        autoNominal: false,
        nominalCapacity: "19",
        stcPrice: "39"
      })
    }
  };

  try {
    const form = {
      elements: {
        usableCapacity: { type: "number", value: "" },
        state: { type: "select-one", value: "" },
        includeNswVpp: { type: "checkbox", checked: false },
        autoNominal: { type: "checkbox", checked: true },
        nominalCapacity: { type: "number", value: "" },
        stcPrice: { type: "number", value: "" }
      }
    };
    restoreSettings(form);

    assert.equal(form.elements.usableCapacity.value, "18");
    assert.equal(form.elements.state.value, "WA");
    assert.equal(form.elements.includeNswVpp.checked, true);
    assert.equal(form.elements.autoNominal.checked, false);
    assert.equal(form.elements.nominalCapacity.value, "19");
    assert.equal(form.elements.stcPrice.value, "39");
  } finally {
    global.window = originalWindow;
  }
});
