import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface PerformanceMetric {
  functionName: string;
  executionTime: number;
  timestamp: number;
  callCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitorService {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private isEnabled = false;

  constructor() {
    // Development módban automatikusan engedélyezzük
    this.isEnabled = !environment.production;
  }

  /**
   * Teljesítmény mérés indítása
   */
  startTimer(functionName: string): string {
    if (!this.isEnabled) return '';

    const timerId = `${functionName}_${Date.now()}_${Math.random()}`;
    performance.mark(timerId);
    return timerId;
  }

  /**
   * Teljesítmény mérés befejezése
   */
  endTimer(timerId: string, functionName: string): void {
    if (!this.isEnabled || !timerId) return;

    try {
      performance.mark(`${timerId}_end`);
      performance.measure(functionName, timerId, `${timerId}_end`);
      
      const measure = performance.getEntriesByName(functionName).pop();
      if (measure) {
        this.recordMetric(functionName, measure.duration);
      }
    } catch (error) {
      console.warn('Performance measurement failed:', error);
    }
  }

  /**
   * Metrika rögzítése
   */
  private recordMetric(functionName: string, executionTime: number): void {
    const existing = this.metrics.get(functionName);
    
    if (existing) {
      existing.executionTime = (existing.executionTime + executionTime) / 2; // Átlag
      existing.callCount++;
      existing.timestamp = Date.now();
    } else {
      this.metrics.set(functionName, {
        functionName,
        executionTime,
        timestamp: Date.now(),
        callCount: 1
      });
    }

    // Log a kritikus teljesítmény problémákról
    if (executionTime > 16) { // 60 FPS = 16ms
      console.warn(`Performance issue detected: ${functionName} took ${executionTime.toFixed(2)}ms`);
    }
  }

  /**
   * Teljesítmény wrapper függvény
   */
  measure<T>(functionName: string, fn: () => T): T {
    if (!this.isEnabled) return fn();

    const timerId = this.startTimer(functionName);
    try {
      return fn();
    } finally {
      this.endTimer(timerId, functionName);
    }
  }

  /**
   * Async teljesítmény wrapper függvény
   */
  async measureAsync<T>(functionName: string, fn: () => Promise<T>): Promise<T> {
    if (!this.isEnabled) return fn();

    const timerId = this.startTimer(functionName);
    try {
      return await fn();
    } finally {
      this.endTimer(timerId, functionName);
    }
  }

  /**
   * Metrikák lekérése
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Teljesítmény riport generálása
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    if (metrics.length === 0) return 'No performance metrics available';

    const report = metrics
      .sort((a, b) => b.executionTime - a.executionTime)
      .map(metric => 
        `${metric.functionName}: ${metric.executionTime.toFixed(2)}ms (${metric.callCount} calls)`
      )
      .join('\n');

    return `Performance Report:\n${report}`;
  }

  /**
   * Teljesítmény monitoring engedélyezése/tiltása
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Metrikák törlése
   */
  clearMetrics(): void {
    this.metrics.clear();
  }
}