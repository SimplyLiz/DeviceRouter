export interface CpuThresholds {
  lowUpperBound: number;
  midUpperBound: number;
}

export interface MemoryThresholds {
  lowUpperBound: number;
  midUpperBound: number;
}

export interface ConnectionThresholds {
  downlink2gUpperBound: number;
  downlink3gUpperBound: number;
  downlink4gUpperBound: number;
}

export interface TierThresholds {
  cpu?: Partial<CpuThresholds>;
  memory?: Partial<MemoryThresholds>;
  connection?: Partial<ConnectionThresholds>;
}

export const DEFAULT_CPU_THRESHOLDS: CpuThresholds = {
  lowUpperBound: 2,
  midUpperBound: 4,
};

export const DEFAULT_MEMORY_THRESHOLDS: MemoryThresholds = {
  lowUpperBound: 2,
  midUpperBound: 4,
};

export const DEFAULT_CONNECTION_THRESHOLDS: ConnectionThresholds = {
  downlink2gUpperBound: 0.5,
  downlink3gUpperBound: 2,
  downlink4gUpperBound: 5,
};
