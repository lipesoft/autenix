import { buildOptions, runPollingIteration } from "./polling-common.js";

export const options = buildOptions({
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "2m",
});

export default function pollingLight() {
  runPollingIteration();
}
