import { buildOptions, runPollingIteration } from "./polling-common.js";

export const options = buildOptions({
  vus: Number(__ENV.VUS || 60),
  duration: __ENV.DURATION || "3m",
});

export default function pollingPeak() {
  runPollingIteration();
}
