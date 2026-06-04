(function () {
  "use strict";

  const STORAGE_KEY = "heatPumpHotWaterCalculatorSettings";

  const SOURCE_URLS = {
    cerWaterHeaters: "https://cer.gov.au/schemes/renewable-energy-target/small-scale-renewable-energy-scheme/small-scale-renewable-energy-systems/solar-water-heaters-and-air-source-heat-pumps",
    cerRegister: "https://cer.gov.au/schemes/renewable-energy-target/small-scale-renewable-energy-scheme/small-scale-renewable-energy-systems/solar-water-heaters/register-solar-water-heaters",
    recCalculator: "https://www.rec-registry.gov.au/rec-registry/app/calculators/swh-stc-calculator",
    nswHotWater: "https://www.energy.nsw.gov.au/households/grants-rebates/household-energy-saving-upgrades/hot-water-upgrade-incentive",
    vicHotWater: "https://www.solar.vic.gov.au/hot-water-rebate/",
    actHomeEnergySupport: "https://www.climatechoices.act.gov.au/policy-programs/home-energy-support-rebates-for-homeowners",
    tasEnergySaverLoan: "https://www.recfit.tas.gov.au/grants_programs/energy-efficiency/energy_saver_loan_scheme",
    qldPlumbing: "https://www.qld.gov.au/law/your-rights/legal-and-property-rights/laws-for-building-houses-and-pools/plumbing-laws"
  };

  const STORAGE_FIELDS = [
    "state",
    "existingSystem",
    "installedCost",
    "tankCapacity",
    "stcCount",
    "stcValue",
    "installDate",
    "modelOnRegister",
    "vicLocalMade",
    "actEligible"
  ];

  function parseNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function normaliseDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return "";
    }
    return value;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: value % 1 === 0 ? 0 : 2
    }).format(value);
  }

  function calculateHeatPumpStateRebate(input, federalEstimate) {
    const state = input.state || "";
    const existingSystem = input.existingSystem || "";
    const installedCost = Math.max(parseNumber(input.installedCost), 0);
    const messages = [];

    if (state === "NSW") {
      if (existingSystem === "electric") {
        return {
          state,
          label: "NSW hot water upgrade incentive",
          rebate: 640,
          messages: [{
            type: "warn",
            text: "NSW publishes an indicative discount of up to $640 when replacing an electric water heater with a heat pump. Actual quotes vary by installer, model, location and compliance costs.",
            link: SOURCE_URLS.nswHotWater,
            linkText: "NSW hot water incentive"
          }]
        };
      }
      if (existingSystem === "gas") {
        return {
          state,
          label: "NSW hot water upgrade incentive",
          rebate: 330,
          messages: [{
            type: "warn",
            text: "NSW publishes an indicative discount of up to $330 when replacing a gas water heater with a heat pump. Actual quotes vary by installer, model, location and compliance costs.",
            link: SOURCE_URLS.nswHotWater,
            linkText: "NSW hot water incentive"
          }]
        };
      }
      messages.push({
        type: "warn",
        text: "NSW hot water upgrade incentives are based on eligible replacement activities. No NSW amount is included for this existing system type.",
        link: SOURCE_URLS.nswHotWater,
        linkText: "NSW hot water incentive"
      });
      return { state, label: "NSW hot water upgrade incentive", rebate: 0, messages };
    }

    if (state === "VIC") {
      if (existingSystem === "new-build") {
        return {
          state,
          label: "Solar Victoria hot water rebate",
          rebate: 0,
          messages: [{
            type: "error",
            text: "Solar Victoria says the hot water rebate is not available for new build homes.",
            link: SOURCE_URLS.vicHotWater,
            linkText: "Solar Victoria hot water rebate"
          }]
        };
      }
      const cap = input.vicLocalMade ? 1400 : 1000;
      const rebateBase = Math.max(installedCost - federalEstimate, 0);
      const rebate = Math.min(rebateBase * 0.5, cap);
      return {
        state,
        label: input.vicLocalMade ? "Solar Victoria locally made hot water rebate" : "Solar Victoria hot water rebate",
        rebate,
        rebateBase,
        cap,
        messages: [{
          type: "warn",
          text: "Solar Victoria calculates the hot water rebate after other discounts and caps it at 50% of the purchase price, up to $" + cap.toLocaleString("en-AU") + ". This estimate subtracts the entered federal STC estimate but does not calculate VEU certificates.",
          link: SOURCE_URLS.vicHotWater,
          linkText: "Solar Victoria hot water rebate"
        }]
      };
    }

    if (state === "ACT") {
      if (!input.actEligible) {
        return {
          state,
          label: "ACT Home Energy Support rebate",
          rebate: 0,
          messages: [{
            type: "warn",
            text: "ACT Home Energy Support can include hot water heat pumps, but it is limited to eligible concession-card owner-occupiers. Tick the ACT eligibility option to include a capped estimate.",
            link: SOURCE_URLS.actHomeEnergySupport,
            linkText: "ACT Home Energy Support"
          }]
        };
      }
      const rebate = Math.min(installedCost * 0.5, 2500);
      return {
        state,
        label: "ACT Home Energy Support rebate",
        rebate,
        cap: 2500,
        messages: [{
          type: "warn",
          text: "ACT Home Energy Support provides 50% of supply and installation costs up to $2,500 for eligible homeowners and eligible products. Confirm concession, owner-occupier, workshop and property value rules.",
          link: SOURCE_URLS.actHomeEnergySupport,
          linkText: "ACT Home Energy Support"
        }]
      };
    }

    if (state === "TAS") {
      return {
        state,
        label: "Tasmania Energy Saver Loan Scheme",
        rebate: 0,
        messages: [{
          type: "warn",
          text: "Tasmania's Energy Saver Loan Scheme listed electric heat pump hot water systems, but the scheme is closed to new applications, so no TAS state amount is included.",
          link: SOURCE_URLS.tasEnergySaverLoan,
          linkText: "Tasmania scheme status"
        }]
      };
    }

    const noPublishedRebate = {
      NT: "No current official NT household heat pump hot water rebate was found, so no NT amount is included.",
      QLD: "No current official Queensland household heat pump hot water rebate was found. Use a licensed plumber for hot water heater work.",
      SA: "No current official South Australian household heat pump hot water rebate was found, so no SA amount is included.",
      WA: "No current official WA household heat pump hot water rebate was found, so no WA amount is included."
    };

    return {
      state,
      label: "No calculable state rebate",
      rebate: 0,
      messages: [{
        type: "warn",
        text: noPublishedRebate[state] || "No calculable state or territory heat pump hot water rebate is included for this selection.",
        link: state === "QLD" ? SOURCE_URLS.qldPlumbing : null,
        linkText: state === "QLD" ? "Queensland plumbing laws" : null
      }]
    };
  }

  function calculateHeatPumpRebate(input) {
    const installedCost = Math.max(parseNumber(input.installedCost), 0);
    const tankCapacity = parseNumber(input.tankCapacity);
    const stcCount = Math.max(Math.floor(parseNumber(input.stcCount)), 0);
    const stcValue = Math.max(parseNumber(input.stcValue), 0);
    const installDate = normaliseDate(input.installDate);
    const modelOnRegister = Boolean(input.modelOnRegister);
    const messages = [];
    let hasBlockingIssue = false;

    if (!installDate) {
      messages.push({ type: "error", text: "Enter the heat pump installation date." });
      hasBlockingIssue = true;
    } else {
      messages.push({
        type: "warn",
        text: "STCs for eligible heat pump water heaters can only be created within 12 months of installation. Confirm timing with the REC Registry or installer.",
        link: SOURCE_URLS.recCalculator,
        linkText: "REC Registry calculator"
      });
    }

    if (!modelOnRegister) {
      messages.push({
        type: "error",
        text: "Only models on the CER register of solar water heaters and air-source heat pumps are eligible for federal STCs.",
        link: SOURCE_URLS.cerRegister,
        linkText: "CER register"
      });
      hasBlockingIssue = true;
    } else {
      messages.push({
        type: "ok",
        text: "Model register eligibility has been confirmed by the user.",
        link: SOURCE_URLS.cerRegister,
        linkText: "CER register"
      });
    }

    if (tankCapacity <= 0) {
      messages.push({ type: "error", text: "Enter the heat pump tank capacity." });
      hasBlockingIssue = true;
    } else if (tankCapacity >= 425) {
      messages.push({
        type: "error",
        text: "CER guidance limits air-source heat pump STC eligibility to systems with capacity less than 425 L.",
        link: SOURCE_URLS.cerWaterHeaters,
        linkText: "CER eligibility"
      });
      hasBlockingIssue = true;
    } else {
      messages.push({ type: "ok", text: "Tank capacity is below the 425 L air-source heat pump STC limit." });
    }

    if (stcCount <= 0) {
      messages.push({
        type: "warn",
        text: "No federal STC amount is included unless you enter the model-specific STC count from the REC Registry calculator or CER register.",
        link: SOURCE_URLS.recCalculator,
        linkText: "REC Registry calculator"
      });
    }

    const federalEstimate = hasBlockingIssue ? 0 : stcCount * stcValue;
    const stateDetails = calculateHeatPumpStateRebate(input, federalEstimate);
    messages.push(...stateDetails.messages);

    const stateEstimate = stateDetails.rebate;
    const totalSupport = federalEstimate + stateEstimate;
    const outOfPocket = Math.max(installedCost - totalSupport, 0);

    return {
      isEligibleEstimate: !hasBlockingIssue,
      federalEstimate,
      stateEstimate,
      totalSupport,
      outOfPocket,
      stcCount,
      stcValue,
      installedCost,
      tankCapacity,
      stateDetails,
      messages
    };
  }

  function getFormInput(form) {
    return {
      state: form.elements.state.value,
      existingSystem: form.elements.existingSystem.value,
      installedCost: form.elements.installedCost.value,
      tankCapacity: form.elements.tankCapacity.value,
      stcCount: form.elements.stcCount.value,
      stcValue: form.elements.stcValue.value,
      installDate: form.elements.installDate.value,
      modelOnRegister: form.elements.modelOnRegister.checked,
      vicLocalMade: form.elements.vicLocalMade.checked,
      actEligible: form.elements.actEligible.checked
    };
  }

  function saveSettings(form) {
    if (typeof window === "undefined" || !window.localStorage || !form) {
      return;
    }
    const settings = {};
    STORAGE_FIELDS.forEach((name) => {
      const element = form.elements[name];
      if (!element) {
        return;
      }
      settings[name] = element.type === "checkbox" ? element.checked : element.value;
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function restoreSettings(form) {
    if (typeof window === "undefined" || !window.localStorage || !form) {
      return;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }
    try {
      const settings = JSON.parse(saved);
      STORAGE_FIELDS.forEach((name) => {
        const element = form.elements[name];
        if (!element || !Object.prototype.hasOwnProperty.call(settings, name)) {
          return;
        }
        if (element.type === "checkbox") {
          element.checked = Boolean(settings[name]);
        } else {
          element.value = settings[name];
        }
      });
    } catch (error) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  function renderMessages(messagesElement, messages) {
    messagesElement.innerHTML = "";
    messages.forEach((message) => {
      const item = document.createElement("li");
      item.className = message.type;
      item.textContent = message.text;
      if (message.link && message.linkText) {
        item.append(" ");
        const link = document.createElement("a");
        link.href = message.link;
        link.rel = "noreferrer";
        link.textContent = message.linkText;
        item.append(link);
      }
      messagesElement.append(item);
    });
  }

  function renderBreakdown(element, result) {
    const stateLine = result.stateDetails.rebateBase !== undefined
      ? "State: min((" + formatMoney(result.stateDetails.rebateBase) + " x 50%), " + formatMoney(result.stateDetails.cap) + ") = " + formatMoney(result.stateEstimate)
      : "State: " + result.stateDetails.label + " = " + formatMoney(result.stateEstimate);

    element.innerHTML = [
      "<p>Federal STC estimate uses the STC count you enter from the REC Registry or CER register.</p>",
      "<ol>",
      "<li>Federal: " + result.stcCount + " STCs x " + formatMoney(result.stcValue) + " = " + formatMoney(result.federalEstimate) + "</li>",
      "<li>" + stateLine + "</li>",
      "<li>Total support: " + formatMoney(result.federalEstimate) + " + " + formatMoney(result.stateEstimate) + " = " + formatMoney(result.totalSupport) + "</li>",
      "<li>Out of pocket: max(" + formatMoney(result.installedCost) + " - " + formatMoney(result.totalSupport) + ", $0) = " + formatMoney(result.outOfPocket) + "</li>",
      "</ol>"
    ].join("");
  }

  function updateStateFields(form) {
    const state = form.elements.state.value;
    const vicField = document.getElementById("vic-local-field");
    const actField = document.getElementById("act-eligible-field");
    if (vicField) {
      vicField.hidden = state !== "VIC";
    }
    if (actField) {
      actField.hidden = state !== "ACT";
    }
  }

  function render() {
    const form = document.getElementById("heat-pump-form");
    if (!form) {
      return;
    }
    updateStateFields(form);

    const result = calculateHeatPumpRebate(getFormInput(form));
    document.getElementById("federal-result").textContent = formatMoney(result.federalEstimate);
    document.getElementById("state-result").textContent = formatMoney(result.stateEstimate);
    document.getElementById("total-result").textContent = formatMoney(result.totalSupport);
    document.getElementById("out-of-pocket-result").textContent = formatMoney(result.outOfPocket);

    const statusDot = document.getElementById("status-dot");
    const status = document.getElementById("eligibility-status");
    statusDot.className = "status-dot " + (result.isEligibleEstimate ? "ok" : "bad");
    status.textContent = result.isEligibleEstimate ? "Federal STC inputs look usable" : "Check required inputs";

    renderMessages(document.getElementById("messages"), result.messages);
    renderBreakdown(document.getElementById("breakdown"), result);
    saveSettings(form);
  }

  function setupHelpBubble() {
    const tips = Array.from(document.querySelectorAll(".info-tip"));
    if (!tips.length) {
      return;
    }
    const bubble = document.createElement("div");
    bubble.className = "help-bubble";
    bubble.hidden = true;
    document.body.append(bubble);

    function show(tip) {
      bubble.textContent = tip.getAttribute("aria-label") || "";
      bubble.hidden = false;
      const rect = tip.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const left = Math.min(Math.max(12, rect.left + rect.width / 2 - bubbleRect.width / 2), window.innerWidth - bubbleRect.width - 12);
      const below = rect.bottom + 10;
      const above = rect.top - bubbleRect.height - 10;
      const top = below + bubbleRect.height <= window.innerHeight - 12 ? below : Math.max(12, above);
      bubble.style.left = left + "px";
      bubble.style.top = top + "px";
    }

    function hide() {
      bubble.hidden = true;
    }

    tips.forEach((tip) => {
      tip.addEventListener("mouseenter", () => show(tip));
      tip.addEventListener("focus", () => show(tip));
      tip.addEventListener("mouseleave", hide);
      tip.addEventListener("blur", hide);
    });
  }

  function init() {
    const form = document.getElementById("heat-pump-form");
    if (!form) {
      return;
    }
    restoreSettings(form);
    form.addEventListener("input", render);
    form.addEventListener("change", render);
    setupHelpBubble();
    render();
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }

  if (typeof module !== "undefined") {
    module.exports = {
      calculateHeatPumpRebate,
      calculateHeatPumpStateRebate,
      STORAGE_KEY
    };
  }
})();
