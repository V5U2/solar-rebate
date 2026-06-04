# Australian Battery Rebate Calculator

A simple static calculator for estimating Australian home battery support using official government sources.

The app estimates:

- federal Cheaper Home Batteries Program STCs
- federal dollar discount using an editable STC value, defaulting to `$40`
- WA Residential Battery Scheme rebate where applicable
- optional NSW Virtual Power Plant incentive estimate
- heat pump hot water STC and state support estimates on a separate page
- total estimated support

It is an estimate only. Installers, retailers, the REC Registry calculator, and the relevant state program rules determine final eligibility and quoted discounts.

## Run Locally

No install step is required.

```sh
python3 -m http.server 8080
```

Open:

```text
http://127.0.0.1:8080/
```

Heat pump hot water page:

```text
http://127.0.0.1:8080/heat-pump-hot-water.html
```

## Test

```sh
npm test
```

The tests cover battery STC calculation, taper bands, eligibility checks, battery state estimates, heat pump hot water state estimates, and browser-storage persistence helpers.

## GitHub Pages

This app can be hosted on GitHub Pages because it is a static root-site app with no build step.

Published site: https://v5u2.github.io/solar-rebate/

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml` that:

- runs `npm test`
- uploads the repository root as the Pages artifact
- deploys to GitHub Pages on pushes to `main`
- also supports manual runs through `workflow_dispatch`

In GitHub, enable Pages with **Settings -> Pages -> Build and deployment -> GitHub Actions** before running the deployment workflow. The standard workflow `GITHUB_TOKEN` can deploy Pages, but it cannot enable Pages for a repository.

## Official Sources

This project should use official sources only for rebate logic:

- DCCEEW Cheaper Home Batteries Program: https://www.dcceew.gov.au/energy/programs/cheaper-home-batteries
- DCCEEW STCs for batteries: https://www.dcceew.gov.au/energy/programs/cheaper-home-batteries/small-scale-technology-certificates
- DCCEEW eligibility information: https://www.dcceew.gov.au/energy/programs/cheaper-home-batteries/eligibility-information
- REC Registry SGU STC calculator: https://www.rec-registry.gov.au/rec-registry/app/calculators/sgu-stc-calculator
- Clean Energy Council approved batteries: https://cleanenergycouncil.org.au/industry-programs/products-program/batteries
- Solar Accreditation Australia accreditation status check: https://saaustralia.com.au/accreditation-status-check/
- WA Residential Battery Scheme eligibility: https://www.wa.gov.au/organisation/energy-policy-wa/wa-residential-battery-scheme-eligibility-requirements
- WA Residential Battery Scheme approved vendor directory: https://www.plenti.com.au/wa-residential-battery-scheme-vendor-directory/
- NSW VPP incentive: https://www.energy.nsw.gov.au/households/grants-rebates/household-energy-saving-upgrades/virtual-power-plant-vpp-incentive
- CER solar water heaters and air-source heat pumps: https://cer.gov.au/schemes/renewable-energy-target/small-scale-renewable-energy-scheme/small-scale-renewable-energy-systems/solar-water-heaters-and-air-source-heat-pumps
- CER register of solar water heaters and air-source heat pumps: https://cer.gov.au/schemes/renewable-energy-target/small-scale-renewable-energy-scheme/small-scale-renewable-energy-systems/solar-water-heaters/register-solar-water-heaters
- REC Registry solar water heater STC calculator: https://www.rec-registry.gov.au/rec-registry/app/calculators/swh-stc-calculator
- NSW hot water upgrade incentive: https://www.energy.nsw.gov.au/households/grants-rebates/household-energy-saving-upgrades/hot-water-upgrade-incentive
- Solar Victoria hot water rebate: https://www.solar.vic.gov.au/hot-water-rebate/
- ACT Home Energy Support rebates: https://www.climatechoices.act.gov.au/policy-programs/home-energy-support-rebates-for-homeowners
- Tasmania Energy Saver Loan Scheme status: https://www.recfit.tas.gov.au/grants_programs/energy-efficiency/energy_saver_loan_scheme

## License

MIT. See [LICENSE](LICENSE).
