(function () {
  "use strict";

  const PROGRAM_START = "2025-07-01";
  const SOURCED_FACTOR_START = "2026-01-01";
  const SOURCE_URLS = {
    program: "https://www.dcceew.gov.au/energy/programs/cheaper-home-batteries",
    stc: "https://www.dcceew.gov.au/energy/programs/cheaper-home-batteries/small-scale-technology-certificates",
    eligibility: "https://www.dcceew.gov.au/energy/programs/cheaper-home-batteries/eligibility-information",
    registry: "https://www.rec-registry.gov.au/rec-registry/app/calculators/sgu-stc-calculator",
    cecBatteries: "https://cleanenergycouncil.org.au/industry-programs/products-program/batteries",
    saaAccreditation: "https://saaustralia.com.au/accreditation-status-check/",
    waVendorDirectory: "https://www.plenti.com.au/wa-residential-battery-scheme-vendor-directory/",
    waEligibility: "https://www.wa.gov.au/organisation/energy-policy-wa/wa-residential-battery-scheme-eligibility-requirements",
    nswVpp: "https://www.energy.nsw.gov.au/households/grants-rebates/household-energy-saving-upgrades/virtual-power-plant-vpp-incentive",
    ntBattery: "https://nt.gov.au/industry/business-grants-funding/home-and-business-battery-scheme",
    qldBattery: "https://www.qld.gov.au/housing/home-modifications-energy-savings/battery-booster-program",
    saBattery: "https://www.energymining.sa.gov.au/consumers/hbs-closed",
    actBattery: "https://www.climatechoices.act.gov.au/energy/home-batteries",
    vicSolar: "https://www.solar.vic.gov.au/"
  };

  const WA_REBATE_RATES = {
    synergy: { label: "Synergy", rate: 130, cap: 1300 },
    horizon: { label: "Horizon Power", rate: 380, cap: 3800 }
  };

  const NSW_VPP_INCENTIVE = {
    label: "NSW VPP incentive",
    rate: 55,
    cap: 1500,
    minCapacity: 2,
    maxCapacity: 28
  };

  const STORAGE_KEY = "batteryRebateCalculatorSettings";
  const STORAGE_FIELDS = [
    "usableCapacity",
    "state",
    "solarSize",
    "waProvider",
    "includeNswVpp",
    "installDate",
    "autoNominal",
    "nominalCapacity",
    "stcPrice"
  ];

  const STC_FACTORS = [
    { start: "2026-01-01", end: "2026-04-30", factor: 8.4, label: "2026 Jan-Apr" },
    { start: "2026-05-01", end: "2026-12-31", factor: 6.8, label: "2026 May-Dec" },
    { start: "2027-01-01", end: "2027-06-30", factor: 5.7, label: "2027 Jan-Jun" },
    { start: "2027-07-01", end: "2027-12-31", factor: 5.2, label: "2027 Jul-Dec" },
    { start: "2028-01-01", end: "2028-06-30", factor: 4.6, label: "2028 Jan-Jun" },
    { start: "2028-07-01", end: "2028-12-31", factor: 4.1, label: "2028 Jul-Dec" },
    { start: "2029-01-01", end: "2029-06-30", factor: 3.6, label: "2029 Jan-Jun" },
    { start: "2029-07-01", end: "2029-12-31", factor: 3.1, label: "2029 Jul-Dec" },
    { start: "2030-01-01", end: "2030-06-30", factor: 2.6, label: "2030 Jan-Jun" },
    { start: "2030-07-01", end: "2030-12-31", factor: 2.1, label: "2030 Jul-Dec" }
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

  function getStcFactor(date) {
    const installDate = normaliseDate(date);
    if (!installDate) {
      return null;
    }
    return STC_FACTORS.find((period) => installDate >= period.start && installDate <= period.end) || null;
  }

  function estimateNominalCapacity(usableCapacity) {
    const usable = parseNumber(usableCapacity);
    if (usable <= 0) {
      return 0;
    }
    return Math.round((usable / 0.9) * 10) / 10;
  }

  function calculateTaperedCapacity(usableCapacity) {
    const countedCapacity = Math.min(Math.max(usableCapacity, 0), 50);
    const firstBand = Math.min(countedCapacity, 14);
    const secondBand = Math.min(Math.max(countedCapacity - 14, 0), 14);
    const thirdBand = Math.min(Math.max(countedCapacity - 28, 0), 22);
    const weightedCapacity = firstBand + secondBand * 0.6 + thirdBand * 0.15;

    return {
      countedCapacity,
      firstBand,
      secondBand,
      thirdBand,
      weightedCapacity
    };
  }

  function calculateWaRebate(usableCapacity, provider) {
    const rate = WA_REBATE_RATES[provider] || WA_REBATE_RATES.synergy;
    const countedCapacity = Math.min(Math.max(parseNumber(usableCapacity), 0), 10);
    const rebate = Math.min(countedCapacity * rate.rate, rate.cap);
    return {
      provider: rate.label,
      rate: rate.rate,
      cap: rate.cap,
      countedCapacity,
      rebate
    };
  }

  function calculateNswVppIncentive(usableCapacity, includeNswVpp) {
    const usable = parseNumber(usableCapacity);
    if (!includeNswVpp || usable < NSW_VPP_INCENTIVE.minCapacity || usable > NSW_VPP_INCENTIVE.maxCapacity) {
      return {
        label: NSW_VPP_INCENTIVE.label,
        rate: NSW_VPP_INCENTIVE.rate,
        cap: NSW_VPP_INCENTIVE.cap,
        countedCapacity: 0,
        rebate: 0,
        included: Boolean(includeNswVpp)
      };
    }
    const rebate = Math.min(usable * NSW_VPP_INCENTIVE.rate, NSW_VPP_INCENTIVE.cap);
    return {
      label: NSW_VPP_INCENTIVE.label,
      rate: NSW_VPP_INCENTIVE.rate,
      cap: NSW_VPP_INCENTIVE.cap,
      countedCapacity: usable,
      rebate,
      included: true
    };
  }

  function calculateBatteryRebate(input) {
    const usableCapacity = parseNumber(input.usableCapacity);
    const nominalCapacity = parseNumber(input.nominalCapacity);
    const solarSize = parseNumber(input.solarSize);
    const stcPrice = parseNumber(input.stcPrice);
    const installDate = normaliseDate(input.installDate);
    const state = input.state || "";
    const waProvider = input.waProvider || "synergy";
    const includeNswVpp = Boolean(input.includeNswVpp);
    const factorPeriod = getStcFactor(installDate);
    const taper = calculateTaperedCapacity(usableCapacity);
    let stateRebate = null;
    if (state === "WA") {
      stateRebate = calculateWaRebate(usableCapacity, waProvider);
    } else if (state === "NSW") {
      stateRebate = calculateNswVppIncentive(usableCapacity, includeNswVpp);
    }
    const messages = [];
    let hasBlockingIssue = false;

    if (!installDate) {
      messages.push({ type: "error", text: "Enter an installation or certification date." });
      hasBlockingIssue = true;
    } else if (installDate < PROGRAM_START) {
      messages.push({ type: "error", text: "Battery systems must be installed on or after 1 July 2025 to be eligible." });
      hasBlockingIssue = true;
    } else if (installDate < SOURCED_FACTOR_START) {
      messages.push({
        type: "warn",
        text: "This date may be eligible, but this calculator only uses the published DCCEEW factor table from 2026 onward. Verify 2025 STCs in the REC Registry calculator."
      });
    }

    if (!factorPeriod && installDate >= SOURCED_FACTOR_START) {
      messages.push({ type: "error", text: "The published DCCEEW factor table runs to 31 December 2030. Use the REC Registry for dates outside that range." });
      hasBlockingIssue = true;
    }

    if (nominalCapacity < 5) {
      messages.push({ type: "error", text: "Nominal battery capacity must be at least 5 kWh." });
      hasBlockingIssue = true;
    } else if (nominalCapacity > 100) {
      messages.push({ type: "error", text: "Nominal battery capacity must not exceed 100 kWh." });
      hasBlockingIssue = true;
    } else {
      messages.push({ type: "ok", text: "Nominal battery capacity is within the 5-100 kWh program range." });
    }

    if (usableCapacity <= 0) {
      messages.push({ type: "error", text: "Usable battery capacity must be greater than 0 kWh." });
      hasBlockingIssue = true;
    } else if (usableCapacity > 50) {
      messages.push({ type: "warn", text: "STCs are only provided for the first 50 kWh of usable capacity." });
    }

    if (solarSize <= 0) {
      messages.push({ type: "error", text: "Battery systems installed without solar PV are not eligible." });
      hasBlockingIssue = true;
    } else if (solarSize >= 100) {
      messages.push({ type: "error", text: "Solar PV systems must be less than 100 kW for this program context." });
      hasBlockingIssue = true;
    } else {
      messages.push({ type: "ok", text: "Solar PV size is present and below 100 kW." });
    }

    messages.push({
      type: "warn",
      text: "Confirm the battery and inverter are on the CEC approved product lists at installation.",
      link: SOURCE_URLS.cecBatteries,
      linkText: "CEC approved batteries"
    });
    messages.push({
      type: "warn",
      text: "Confirm the installation is completed by or supervised on site by an SAA-accredited installer.",
      link: SOURCE_URLS.saaAccreditation,
      linkText: "Check SAA accreditation"
    });
    messages.push({ type: "warn", text: "Confirm VPP capability for on-grid systems and local electrical compliance in " + state + "." });
    if (state === "WA" && stateRebate) {
      messages.push({
        type: "warn",
        text: "WA rebate estimate uses " + stateRebate.provider + ": $" + stateRebate.rate + "/kWh for up to 10 kWh, capped at $" + stateRebate.cap.toLocaleString("en-AU") + ". Confirm WA scheme eligibility, VPP participation, approved vendor and supported product requirements.",
        link: SOURCE_URLS.waVendorDirectory,
        linkText: "WA approved vendors"
      });
    } else if (state === "NSW") {
      if (includeNswVpp && stateRebate && stateRebate.rebate > 0) {
        messages.push({
          type: "warn",
          text: "NSW VPP estimate uses $" + NSW_VPP_INCENTIVE.rate + "/kWh up to " + NSW_VPP_INCENTIVE.maxCapacity + " kWh, capped at $" + NSW_VPP_INCENTIVE.cap.toLocaleString("en-AU") + ". Actual offers vary by VPP provider and contract."
        });
      } else if (includeNswVpp) {
        messages.push({
          type: "warn",
          text: "NSW VPP incentive is only for eligible batteries from " + NSW_VPP_INCENTIVE.minCapacity + " to " + NSW_VPP_INCENTIVE.maxCapacity + " kWh and depends on joining a VPP."
        });
      } else {
        messages.push({
          type: "warn",
          text: "NSW has a VPP incentive for eligible batteries, but it is optional and provider-dependent. Tick the NSW VPP option to include an estimate."
        });
      }
    } else if (state === "NT") {
      messages.push({ type: "warn", text: "NT Home and Business Battery Scheme has reached its funding allocation and is closed to new grants, so no NT rebate is included." });
    } else if (state === "QLD") {
      messages.push({ type: "warn", text: "Queensland Battery Booster program is closed and rebates are no longer available, so no QLD rebate is included." });
    } else if (state === "SA") {
      messages.push({ type: "warn", text: "South Australia's Home Battery Scheme is closed and new applications are not accepted, so no SA rebate is included." });
    } else if (state === "ACT") {
      messages.push({ type: "warn", text: "ACT support is currently loan-style household support rather than a direct calculable household battery rebate, so no ACT rebate is included." });
    } else if (state === "VIC") {
      messages.push({ type: "warn", text: "Victoria lists solar battery loans, not a direct calculable battery rebate in this calculator, so no VIC state rebate is included." });
    } else if (state === "TAS") {
      messages.push({ type: "warn", text: "No current official Tasmanian household battery rebate was found, so no TAS state rebate is included." });
    }

    const rawStcs = factorPeriod ? taper.weightedCapacity * factorPeriod.factor : 0;
    const stcs = hasBlockingIssue || !factorPeriod ? 0 : Math.floor(rawStcs);
    const discount = stcs * stcPrice;
    const stateRebateAmount = hasBlockingIssue || !stateRebate ? 0 : stateRebate.rebate;

    return {
      isEligibleEstimate: !hasBlockingIssue && Boolean(factorPeriod),
      stcs,
      rawStcs,
      discount,
      stateRebate: stateRebateAmount,
      totalDiscount: discount + stateRebateAmount,
      stateRebateDetails: stateRebate,
      factor: factorPeriod ? factorPeriod.factor : null,
      factorLabel: factorPeriod ? factorPeriod.label : "Verify in REC Registry",
      taper,
      messages,
      sourceUrls: SOURCE_URLS
    };
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatNumber(value, decimals) {
    return new Intl.NumberFormat("en-AU", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  }

  function readForm(form) {
    const data = new FormData(form);
    return {
      usableCapacity: data.get("usableCapacity"),
      nominalCapacity: data.get("nominalCapacity"),
      state: data.get("state"),
      solarSize: data.get("solarSize"),
      installDate: data.get("installDate"),
      stcPrice: data.get("stcPrice"),
      waProvider: data.get("waProvider"),
      includeNswVpp: data.get("includeNswVpp") === "on"
    };
  }

  function storageAvailable() {
    try {
      return typeof window !== "undefined" && Boolean(window.localStorage);
    } catch (error) {
      return false;
    }
  }

  function saveSettings(form) {
    if (!storageAvailable()) {
      return;
    }
    const settings = {};
    STORAGE_FIELDS.forEach((field) => {
      const input = form.elements[field];
      if (!input) {
        return;
      }
      if (input.type === "checkbox") {
        settings[field] = input.checked;
      } else {
        settings[field] = input.value;
      }
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function restoreSettings(form) {
    if (!storageAvailable()) {
      return;
    }
    let settings = null;
    try {
      settings = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    } catch (error) {
      settings = null;
    }
    if (!settings || typeof settings !== "object") {
      return;
    }
    STORAGE_FIELDS.forEach((field) => {
      const input = form.elements[field];
      if (!input || settings[field] === undefined) {
        return;
      }
      if (input.type === "checkbox") {
        input.checked = Boolean(settings[field]);
      } else {
        input.value = String(settings[field]);
      }
    });
  }

  function syncEstimatedNominal() {
    const usableInput = document.getElementById("usableCapacity");
    const nominalInput = document.getElementById("nominalCapacity");
    const autoNominal = document.getElementById("autoNominal");
    if (!usableInput || !nominalInput || !autoNominal || !autoNominal.checked) {
      return;
    }
    nominalInput.value = estimateNominalCapacity(usableInput.value).toFixed(1);
  }

  function render(result) {
    const statusDot = document.getElementById("status-dot");
    const status = document.getElementById("eligibility-status");
    const stcResult = document.getElementById("stc-result");
    const discountResult = document.getElementById("discount-result");
    const stateRebateResult = document.getElementById("state-rebate-result");
    const totalDiscountResult = document.getElementById("total-discount-result");
    const factorResult = document.getElementById("factor-result");
    const capacityResult = document.getElementById("capacity-result");
    const breakdown = document.getElementById("breakdown");
    const messages = document.getElementById("messages");

    statusDot.className = "status-dot";
    if (result.isEligibleEstimate) {
      statusDot.classList.add("ok");
      status.textContent = "Estimate available";
    } else if (result.messages.some((message) => message.type === "error")) {
      statusDot.classList.add("bad");
      status.textContent = "Fix eligibility inputs";
    } else {
      status.textContent = "Verify with REC Registry";
    }

    stcResult.textContent = String(result.stcs);
    discountResult.textContent = formatCurrency(result.discount);
    stateRebateResult.textContent = formatCurrency(result.stateRebate);
    totalDiscountResult.textContent = formatCurrency(result.totalDiscount);
    factorResult.textContent = result.factor === null ? "-" : formatNumber(result.factor, 1);
    capacityResult.textContent = formatNumber(result.taper.countedCapacity, 1) + " kWh";

    const stcPriceValue = result.stcs > 0 ? result.discount / result.stcs : 0;
    const stateWorking = result.stateRebateDetails
      ? "<li><strong>State rebate:</strong> min(" +
          formatNumber(result.stateRebateDetails.countedCapacity, 1) + " kWh x $" +
          result.stateRebateDetails.rate + ", " +
          formatCurrency(result.stateRebateDetails.cap) + ") = " +
          formatCurrency(result.stateRebate) + ".</li>"
      : "<li><strong>State rebate:</strong> no calculable state or territory rebate is included = $0.</li>";
    breakdown.innerHTML = [
      "<p><strong>Factor period:</strong> " + result.factorLabel + "</p>",
      "<ol>",
      "<li><strong>Capacity cap:</strong> min(usable capacity, 50 kWh) = " + formatNumber(result.taper.countedCapacity, 1) + " kWh.</li>",
      "<li><strong>Tapered capacity:</strong> (" +
        formatNumber(result.taper.firstBand, 1) + " x 100%) + (" +
        formatNumber(result.taper.secondBand, 1) + " x 60%) + (" +
        formatNumber(result.taper.thirdBand, 1) + " x 15%) = " +
        formatNumber(result.taper.weightedCapacity, 2) + " kWh.</li>",
      "<li><strong>Raw STCs:</strong> " + formatNumber(result.taper.weightedCapacity, 2) + " x " +
        (result.factor === null ? "0" : formatNumber(result.factor, 1)) + " = " +
        formatNumber(result.rawStcs, 2) + ".</li>",
      "<li><strong>Estimated STCs:</strong> floor(" + formatNumber(result.rawStcs, 2) + ") = " + result.stcs + ".</li>",
      "<li><strong>Federal estimate:</strong> " + result.stcs + " STCs x " + formatCurrency(stcPriceValue) + " = " + formatCurrency(result.discount) + ".</li>",
      stateWorking,
      "<li><strong>Total estimate:</strong> " + formatCurrency(result.discount) + " + " + formatCurrency(result.stateRebate) + " = " + formatCurrency(result.totalDiscount) + ".</li>",
      "</ol>"
    ].join("");

    messages.innerHTML = "";
    result.messages.forEach((message) => {
      const item = document.createElement("li");
      item.className = message.type === "ok" ? "" : message.type;
      item.textContent = message.text;
      if (message.link) {
        const separator = document.createTextNode(" ");
        const link = document.createElement("a");
        link.href = message.link;
        link.rel = "noreferrer";
        link.textContent = message.linkText || "Source";
        item.appendChild(separator);
        item.appendChild(link);
      }
      messages.appendChild(item);
    });
  }

  function getHelpBubble() {
    let bubble = document.getElementById("help-bubble");
    if (!bubble) {
      bubble = document.createElement("div");
      bubble.id = "help-bubble";
      bubble.className = "help-bubble";
      bubble.hidden = true;
      bubble.setAttribute("role", "tooltip");
      document.body.appendChild(bubble);
    }
    return bubble;
  }

  function positionHelpBubble(trigger, bubble) {
    const margin = 12;
    const gap = 10;
    const triggerRect = trigger.getBoundingClientRect();
    bubble.hidden = false;
    const bubbleRect = bubble.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const preferredTop = triggerRect.bottom + gap;
    const fallbackTop = triggerRect.top - bubbleRect.height - gap;
    const top = preferredTop + bubbleRect.height <= viewportHeight - margin
      ? preferredTop
      : Math.max(margin, fallbackTop);
    const centeredLeft = triggerRect.left + triggerRect.width / 2 - bubbleRect.width / 2;
    const left = Math.min(
      Math.max(margin, centeredLeft),
      Math.max(margin, viewportWidth - bubbleRect.width - margin)
    );
    bubble.style.top = Math.round(top) + "px";
    bubble.style.left = Math.round(left) + "px";
  }

  function showHelpBubble(trigger) {
    const text = trigger.getAttribute("aria-label");
    if (!text) {
      return;
    }
    const bubble = getHelpBubble();
    bubble.textContent = text;
    positionHelpBubble(trigger, bubble);
    trigger.setAttribute("aria-describedby", "help-bubble");
    getHelpBubble.activeTrigger = trigger;
  }

  function hideHelpBubble() {
    const bubble = getHelpBubble();
    if (getHelpBubble.activeTrigger) {
      getHelpBubble.activeTrigger.removeAttribute("aria-describedby");
      getHelpBubble.activeTrigger = null;
    }
    bubble.hidden = true;
  }

  function repositionHelpBubble() {
    const bubble = getHelpBubble();
    if (!bubble.hidden && getHelpBubble.activeTrigger) {
      positionHelpBubble(getHelpBubble.activeTrigger, bubble);
    }
  }

  function init() {
    const form = document.getElementById("calculator-form");
    if (!form) {
      return;
    }
    restoreSettings(form);
    const update = (event) => {
      if (event && event.target && event.target.id === "nominalCapacity") {
        const autoNominal = document.getElementById("autoNominal");
        if (autoNominal) {
          autoNominal.checked = false;
        }
      }
      syncEstimatedNominal();
      const stateSelect = document.getElementById("state");
      const waProviderField = document.getElementById("wa-provider-field");
      const nswVppField = document.getElementById("nsw-vpp-field");
      if (stateSelect && waProviderField) {
        waProviderField.hidden = stateSelect.value !== "WA";
      }
      if (stateSelect && nswVppField) {
        nswVppField.hidden = stateSelect.value !== "NSW";
      }
      render(calculateBatteryRebate(readForm(form)));
      saveSettings(form);
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    document.addEventListener("click", (event) => {
      if (event.target && event.target.classList && event.target.classList.contains("info-tip")) {
        event.preventDefault();
        event.stopPropagation();
        event.target.focus();
        showHelpBubble(event.target);
        return;
      }
      hideHelpBubble();
    });
    document.addEventListener("focusin", (event) => {
      if (event.target && event.target.classList && event.target.classList.contains("info-tip")) {
        showHelpBubble(event.target);
      }
    });
    document.addEventListener("focusout", (event) => {
      if (event.target && event.target.classList && event.target.classList.contains("info-tip")) {
        hideHelpBubble();
      }
    });
    document.addEventListener("mouseover", (event) => {
      if (event.target && event.target.classList && event.target.classList.contains("info-tip")) {
        showHelpBubble(event.target);
      }
    });
    document.addEventListener("mouseout", (event) => {
      if (event.target && event.target.classList && event.target.classList.contains("info-tip")) {
        hideHelpBubble();
      }
    });
    window.addEventListener("resize", repositionHelpBubble);
    window.addEventListener("scroll", repositionHelpBubble, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideHelpBubble();
      }
    });
    update();
  }

  if (typeof document !== "undefined") {
    init();
  }

  if (typeof module !== "undefined") {
    module.exports = {
      calculateBatteryRebate,
      calculateNswVppIncentive,
      calculateTaperedCapacity,
      calculateWaRebate,
      estimateNominalCapacity,
      getStcFactor,
      restoreSettings,
      saveSettings,
      NSW_VPP_INCENTIVE,
      STORAGE_KEY,
      WA_REBATE_RATES,
      STC_FACTORS
    };
  }
})();
