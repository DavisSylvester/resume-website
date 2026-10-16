/** Starts background processing of queued pushes (async Lambda self-invoke in AWS). */
export interface AsyncTrigger {
  trigger(): Promise<void>;
}
