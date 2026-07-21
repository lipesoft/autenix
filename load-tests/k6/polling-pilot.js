import { buildOptions, runPollingIteration } from "./polling-common.js";

export const options = buildOptions({
  vus: Number(__ENV.VUS || 25),
  duration: __ENV.DURATION || "5m",
});

export default function pollingPilot() {
  runPollingIteration();
}
