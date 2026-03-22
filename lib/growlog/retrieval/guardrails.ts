import type {
  AnswerAssemblyContext,
  AssemblyGuardrails,
  IntentClassification,
  RetrievalIntentType,
} from '@/types/retrieval-assembly';

function hasAnySignal(ctx: AnswerAssemblyContext): boolean {
  return (
    ctx.sensorContext.length > 0 ||
    ctx.photoContext.some((p) => p.analysisSummary) ||
    ctx.photoTimelineSignals.length > 0 ||
    ctx.sopContext.length > 0 ||
    ctx.anomalyContext.length > 0
  );
}

/** ADR-003 diagnostic: «минимум один recent event или observation» — observations отдельной таблицей. */
function hasRecentEventOrObservation(ctx: AnswerAssemblyContext): boolean {
  return (
    ctx.recentEvents.length > 0 ||
    ctx.anomalyContext.length > 0 ||
    ctx.observations.length > 0
  );
}

function isDiagnosticTopic(intent: RetrievalIntentType, risk: string): boolean {
  return (
    (intent === 'causal' || intent === 'action') &&
    (risk === 'medium' || risk === 'high')
  );
}

/**
 * ADR-003 guardrails + missing_data for obvious gaps (deterministic).
 */
export function buildGuardrailsAndMissingData(
  intent: IntentClassification,
  scope: { cycleId: string | null; needsClarification: boolean },
  ctx: AnswerAssemblyContext
): { guardrails: AssemblyGuardrails; missingData: string[] } {
  const missing: string[] = [];

  if (scope.needsClarification) {
    missing.push('Нужно уточнить scope/зону: вопрос допускает несколько равновероятных трактовок.');
  }

  if (!scope.cycleId && (intent.intentType === 'action' || intent.intentType === 'daily_focus')) {
    missing.push('Не выбран активный цикл — операционные советы по циклу ограничены.');
  }

  if (!ctx.sensorContext.length) {
    missing.push('Нет недавних замеров сенсоров в выбранном окне (или не заведены датчики).');
  }

  if (!ctx.photoContext.length && intent.requiresPhotoContext) {
    missing.push('Нет недавних фото в выборке для визуального сигнала.');
  } else if (intent.requiresPhotoContext && ctx.photoContext.length > 0) {
    const hasAnyAnalysis = ctx.photoContext.some((p) => p.analysisSummary);
    const processing = ctx.photoContext.some(
      (p) => p.analysisStatus === 'processing_analysis'
    );
    const failed = ctx.photoContext.some((p) => p.analysisStatus === 'analysis_failed');

    if (!hasAnyAnalysis && processing) {
      missing.push(
        'Фото есть, vision-анализ ещё выполняется (processing) — не выдумывай визуальные признаки до готового photo_analysis.'
      );
    } else if (!hasAnyAnalysis && failed && !processing) {
      missing.push(
        'Фото есть, но vision-анализ для снимков не удался — опирайся на сенсоры, события и SOP, не на недоступные кадры.'
      );
    } else if (!hasAnyAnalysis && !processing && !failed) {
      missing.push(
        'Фото есть, но нет photo_analysis — не выдумывай визуальные признаки по метаданным.'
      );
    } else if (hasAnyAnalysis && processing) {
      missing.push(
        'Часть фото всё ещё в очереди на анализ — не дополняй эти кадры выдуманными деталями.'
      );
    } else if (hasAnyAnalysis && failed) {
      missing.push(
        'Для части фото vision-анализ завершился с ошибкой — не опирайся на отсутствующие интерпретации.'
      );
    }
  }

  if (!ctx.sopContext.length && intent.requiresSopContext) {
    missing.push('Нет открытых/просроченных SOP runs в контексте цикла.');
  }

  const diagnostic = isDiagnosticTopic(
    intent.intentType,
    intent.diagnosticRiskLevel
  );
  const signalOk = hasAnySignal(ctx);
  const eventOk = hasRecentEventOrObservation(ctx);

  if (diagnostic && (!eventOk || !signalOk)) {
    missing.push(
      'Для причинно-следственного/действенного ответа по симптомам нужен минимум одно недавнее событие и один сигнал (сенсор, фото+анализ, SOP или аномалия).'
    );
  }

  const guardrails: AssemblyGuardrails = {
    mustNotClaimWithoutEvidence: true,
    mustAskClarifyingQuestionIfScopeAmbiguous: scope.needsClarification,
    blockStrongCausalOrActionWithoutSignals: diagnostic && (!eventOk || !signalOk),
    blockFarmActionAdviceWithoutCycle: !scope.cycleId && intent.intentType === 'action',
  };

  return { guardrails, missingData: missing };
}
