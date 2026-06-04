const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateHeatPumpRebate,
  calculateHeatPumpStateRebate
} = require("./heat-pump-hot-water.js");

function baseInput(overrides = {}) {
  return {
    state: "VIC",
    existingSystem: "electric",
    installedCost: 3500,
    tankCapacity: 270,
    stcCount: 22,
    stcValue: 40,
    installDate: "2026-06-04",
    modelOnRegister: true,
    vicLocalMade: false,
    actEligible: false,
    ...overrides
  };
}

test("calculates federal heat pump STC estimate from entered STCs", () => {
  const result = calculateHeatPumpRebate(baseInput({ state: "WA" }));

  assert.equal(result.federalEstimate, 880);
  assert.equal(result.stateEstimate, 0);
  assert.equal(result.totalSupport, 880);
  assert.equal(result.outOfPocket, 2620);
});

test("blocks federal STC estimate when model is not confirmed on the CER register", () => {
  const result = calculateHeatPumpRebate(baseInput({ modelOnRegister: false }));

  assert.equal(result.isEligibleEstimate, false);
  assert.equal(result.federalEstimate, 0);
  assert.ok(result.messages.some((message) => message.type === "error" && message.text.includes("CER register")));
});

test("blocks federal STC estimate at the air-source heat pump tank capacity limit", () => {
  const result = calculateHeatPumpRebate(baseInput({ tankCapacity: 425 }));

  assert.equal(result.isEligibleEstimate, false);
  assert.equal(result.federalEstimate, 0);
  assert.ok(result.messages.some((message) => message.type === "error" && message.text.includes("less than 425 L")));
});

test("calculates NSW indicative hot water upgrade amounts by replacement type", () => {
  assert.equal(calculateHeatPumpStateRebate(baseInput({ state: "NSW", existingSystem: "electric" }), 880).rebate, 640);
  assert.equal(calculateHeatPumpStateRebate(baseInput({ state: "NSW", existingSystem: "gas" }), 880).rebate, 330);
  assert.equal(calculateHeatPumpStateRebate(baseInput({ state: "NSW", existingSystem: "heat-pump" }), 880).rebate, 0);
});

test("calculates standard Solar Victoria hot water rebate after entered STCs", () => {
  const result = calculateHeatPumpRebate(baseInput({
    state: "VIC",
    installedCost: 3500,
    stcCount: 22,
    stcValue: 40,
    vicLocalMade: false
  }));

  assert.equal(result.federalEstimate, 880);
  assert.equal(result.stateEstimate, 1000);
  assert.equal(result.stateDetails.rebateBase, 2620);
  assert.equal(result.totalSupport, 1880);
});

test("calculates Solar Victoria locally made cap", () => {
  const result = calculateHeatPumpRebate(baseInput({
    state: "VIC",
    installedCost: 5000,
    stcCount: 10,
    stcValue: 40,
    vicLocalMade: true
  }));

  assert.equal(result.federalEstimate, 400);
  assert.equal(result.stateEstimate, 1400);
  assert.equal(result.totalSupport, 1800);
});

test("excludes Solar Victoria rebate for new builds", () => {
  const result = calculateHeatPumpRebate(baseInput({ state: "VIC", existingSystem: "new-build" }));

  assert.equal(result.stateEstimate, 0);
  assert.ok(result.messages.some((message) => message.type === "error" && message.text.includes("new build")));
});

test("calculates ACT Home Energy Support only when eligible option is selected", () => {
  const excluded = calculateHeatPumpRebate(baseInput({ state: "ACT", actEligible: false }));
  const included = calculateHeatPumpRebate(baseInput({ state: "ACT", actEligible: true, installedCost: 6000 }));

  assert.equal(excluded.stateEstimate, 0);
  assert.equal(included.stateEstimate, 2500);
});

test("does not calculate closed or unavailable state programs", () => {
  ["NT", "QLD", "SA", "TAS", "WA"].forEach((state) => {
    const result = calculateHeatPumpRebate(baseInput({ state }));
    assert.equal(result.stateEstimate, 0);
    assert.equal(result.totalSupport, result.federalEstimate);
  });
});
