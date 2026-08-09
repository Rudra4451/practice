import { TelemetryForecast } from '../types';

/**
 * Deterministic Linear Regression Telemetry Forecasting Engine (ADR-014 & Revision 7)
 */
export class PredictionEngine {
  public static forecastProgression(history: Array<{ created_at: string; wpm: number }>): TelemetryForecast {
    if (!history || history.length < 3) {
      return {
        wpm7DayForecast: 65,
        wpm30DayForecast: 75,
        plateauRisk: false,
        estimatedDaysToNextMilestone: 14,
        confidenceInterval: { lower: 60, upper: 70 },
      };
    }

    // Sort by timestamp
    const sorted = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const n = sorted.length;
    const yValues = sorted.map((h) => h.wpm);
    const xValues = sorted.map((_, i) => i + 1); // Session indices

    // Linear regression: y = beta1 * x + beta0
    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xValues[i] - xMean) * (yValues[i] - yMean);
      den += Math.pow(xValues[i] - xMean, 2);
    }

    const beta1 = den !== 0 ? num / den : 0;
    const beta0 = yMean - beta1 * xMean;

    // Forecast for +7 sessions (~7 days at 1 run/day) and +30 sessions
    const wpm7DayForecast = Math.max(0, Math.round(beta0 + beta1 * (n + 7)));
    const wpm30DayForecast = Math.max(0, Math.round(beta0 + beta1 * (n + 30)));

    // Plateau Risk: If slope is flat (< 0.05) over 10+ sessions
    const plateauRisk = n >= 10 && Math.abs(beta1) < 0.05;

    // Next Speed Tier Milestone (e.g. 80, 100, 120, 140 WPM)
    const currentMax = Math.max(...yValues);
    const nextMilestone = [60, 80, 100, 120, 140, 160].find((m) => m > currentMax) || currentMax + 20;
    const sessionsNeeded = beta1 > 0 ? Math.ceil((nextMilestone - beta0) / beta1) - n : 30;
    const estimatedDaysToNextMilestone = Math.max(1, Math.min(180, sessionsNeeded));

    // Standard Error of Regression for Confidence Bounds
    const residuals = yValues.map((y, i) => y - (beta0 + beta1 * xValues[i]));
    const mse = residuals.reduce((a, b) => a + Math.pow(b, 2), 0) / Math.max(1, n - 2);
    const stdErr = Math.sqrt(mse);

    return {
      wpm7DayForecast,
      wpm30DayForecast,
      plateauRisk,
      estimatedDaysToNextMilestone,
      confidenceInterval: {
        lower: Math.max(0, Math.round(wpm7DayForecast - stdErr)),
        upper: Math.round(wpm7DayForecast + stdErr),
      },
    };
  }
}
