/**
 * Pipeline version tracking for eval comparison and release safety.
 * Every extraction result carries these versions so diffs can be attributed.
 */

export const CURRENT_PIPELINE_VERSION = "4.0.0";
export const CURRENT_PROMPT_VERSION = "extraction-v3";
export const CURRENT_SCHEMA_VERSION = "envelope-v2";
export const CURRENT_CLASSIFIER_VERSION = "classifier-v2";

export type PipelineVersionInfo = {
  pipelineVersion: string;
  promptVersion: string;
  schemaVersion: string;
  classifierVersion: string;
};

export function getPipelineVersionInfo(): PipelineVersionInfo {
  return {
    pipelineVersion: CURRENT_PIPELINE_VERSION,
    promptVersion: CURRENT_PROMPT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    classifierVersion: CURRENT_CLASSIFIER_VERSION,
  };
}
