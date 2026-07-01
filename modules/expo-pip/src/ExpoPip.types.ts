export type ExpoPipModuleEvents = {
  onPipModeChanged: (params: PipModeChangedEvent) => void;
};

export type PipAspectRatio = {
  readonly num: number;
  readonly den: number;
};

export type PipEnterOptions = {
  readonly aspectRatio?: PipAspectRatio;
};

export type PipModeChangedEvent = {
  readonly isInPip: boolean;
  readonly isSupported: boolean;
};
