import { queryPrometheus } from "./collectors/prometheus";

async function main() {
  const result = await queryPrometheus("up");

  console.log(result);
}

main();
