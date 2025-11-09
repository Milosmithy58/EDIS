declare module 'd3-scale' {
  type ScaleBand<Domain extends string | number = string> = {
    (value: Domain): number | undefined;
    domain(values: Domain[]): ScaleBand<Domain>;
    range(values: readonly [number, number]): ScaleBand<Domain>;
    padding(padding: number): ScaleBand<Domain>;
    bandwidth(): number;
  };

  type ScaleLinear<Output extends number = number> = {
    (value: number): Output;
    domain(values: readonly [number, number]): ScaleLinear<Output>;
    range(values: readonly [number, number]): ScaleLinear<Output>;
  };

  export function scaleBand<Domain extends string | number = string>(): ScaleBand<Domain>;
  export function scaleLinear<Output extends number = number>(): ScaleLinear<Output>;
}
