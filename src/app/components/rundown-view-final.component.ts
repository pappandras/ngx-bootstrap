import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Observable, combineLatest, Subject } from 'rxjs';
import { map, distinctUntilChanged, shareReplay, takeUntil } from 'rxjs/operators';
import { PerformanceMonitorService } from '../services/performance-monitor.service';

interface RDLINE {
  id: string;
  content: string;
  // ... további tulajdonságok
}

interface RundownDragData {
  sourceUid: string;
  formatUid: string;
  lines: RDLINE[];
}

interface Content {
  docReference: {
    _attributes: {
      UID: string;
    };
  };
  RUNDOWN: {
    BODY: {
      RDLINE: RDLINE | RDLINE[];
    };
  };
}

interface AdditionalContent {
  rdFormat?: {
    docReference?: {
      _attributes: {
        UID: string;
      };
    };
  };
}

@Component({
  selector: 'app-rundown-view-final',
  templateUrl: './rundown-view-final.component.html',
  styleUrls: ['./rundown-view-final.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RundownViewFinalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() content: Content | null = null;
  @Input() additionalContent: AdditionalContent = {};
  @Input() selectedRows: RDLINE[] = [];
  @Input() filteredRdLines: RDLINE[] = [];

  // Observable-ok
  private contentSubject = new BehaviorSubject<Content | null>(null);
  private additionalContentSubject = new BehaviorSubject<AdditionalContent>({});
  private selectedRowsSubject = new BehaviorSubject<RDLINE[]>([]);
  private filteredRdLinesSubject = new BehaviorSubject<RDLINE[]>([]);
  private destroy$ = new Subject<void>();

  // Computed properties
  public dragDataMap$: Observable<Map<string, RundownDragData>>;
  public optimizedFilteredRdLines$: Observable<RDLINE[]>;

  // Cache
  private dragDataCache = new Map<string, RundownDragData>();
  private lastCacheKey = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private performanceMonitor: PerformanceMonitorService
  ) {
    this.initializeComputedProperties();
  }

  ngOnInit(): void {
    this.setupSubscriptions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.handleInputChanges(changes);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupSubjects();
    this.dragDataCache.clear();
  }

  /**
   * Computed properties inicializálása
   */
  private initializeComputedProperties(): void {
    // Drag data map computed property
    this.dragDataMap$ = combineLatest([
      this.contentSubject,
      this.additionalContentSubject,
      this.selectedRowsSubject,
      this.filteredRdLinesSubject
    ]).pipe(
      map(([content, additionalContent, selectedRows, filteredRdLines]) => {
        return this.performanceMonitor.measure('computeDragDataMap', () => 
          this.computeDragDataMap(content, additionalContent, selectedRows, filteredRdLines)
        );
      }),
      distinctUntilChanged(),
      shareReplay(1)
    );

    // Optimized filtered rd lines
    this.optimizedFilteredRdLines$ = this.filteredRdLinesSubject.pipe(
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  /**
   * Subscription-ok beállítása
   */
  private setupSubscriptions(): void {
    this.dragDataMap$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  /**
   * Input változások kezelése
   */
  private handleInputChanges(changes: SimpleChanges): void {
    if (changes['content']) {
      this.contentSubject.next(this.content);
    }
    if (changes['additionalContent']) {
      this.additionalContentSubject.next(this.additionalContent);
    }
    if (changes['selectedRows']) {
      this.selectedRowsSubject.next(this.selectedRows);
    }
    if (changes['filteredRdLines']) {
      this.filteredRdLinesSubject.next(this.filteredRdLines);
    }
  }

  /**
   * Computed drag data map létrehozása
   */
  private computeDragDataMap(
    content: Content | null,
    additionalContent: AdditionalContent,
    selectedRows: RDLINE[],
    filteredRdLines: RDLINE[]
  ): Map<string, RundownDragData> {
    const dragDataMap = new Map<string, RundownDragData>();

    // Alapvető validációk
    if (!content || !content.docReference._attributes.UID || !additionalContent.rdFormat) {
      return dragDataMap;
    }

    const _rdLines = content.RUNDOWN.BODY.RDLINE;
    const rdLines = Array.isArray(_rdLines) ? _rdLines : [_rdLines];
    const selectedRowsSet = new Set(selectedRows);

    // Előre kiszámoljuk a drag data-t minden elemre
    filteredRdLines.forEach(rdline => {
      const cacheKey = this.generateCacheKey(rdline, content.docReference._attributes.UID, selectedRows);
      
      let data = [rdline];
      if (selectedRows.length > 0 && selectedRowsSet.has(rdline)) {
        data = rdLines.filter(line => selectedRowsSet.has(line));
      }

      const dragData: RundownDragData = {
        sourceUid: content.docReference._attributes.UID,
        formatUid: additionalContent.rdFormat?.docReference?._attributes.UID,
        lines: data,
      };

      dragDataMap.set(cacheKey, dragData);
    });

    return dragDataMap;
  }

  /**
   * Cache key generálása
   */
  private generateCacheKey(rdline: RDLINE, contentUid: string, selectedRows: RDLINE[]): string {
    const selectedRowsHash = this.getSelectedRowsHash(selectedRows);
    const rdlineId = rdline.id || JSON.stringify(rdline);
    
    return `${contentUid}_${selectedRowsHash}_${rdlineId}`;
  }

  /**
   * Selected rows hash generálása
   */
  private getSelectedRowsHash(selectedRows: RDLINE[]): string {
    if (selectedRows.length === 0) return 'empty';
    return selectedRows.map(row => row.id).sort().join('_');
  }

  /**
   * Optimalizált getDragData függvény
   */
  getDragData(rdline: RDLINE): RundownDragData | null {
    return this.performanceMonitor.measure('getDragData', () => {
      // Cache ellenőrzése
      const cacheKey = this.generateCacheKey(rdline, this.content?.docReference._attributes.UID || '', this.selectedRows);
      const cachedData = this.dragDataCache.get(cacheKey);
      
      if (cachedData) {
        return cachedData; // Cache hit!
      }

      // Ha nincs cache-ben, akkor a computed map-ből vesszük
      let result: RundownDragData | null = null;
      
      this.dragDataMap$.pipe(
        takeUntil(this.destroy$)
      ).subscribe(dragDataMap => {
        result = dragDataMap.get(cacheKey) || null;
        if (result) {
          this.dragDataCache.set(cacheKey, result);
        }
      }).unsubscribe();

      return result;
    });
  }

  /**
   * Track by függvény az *ngFor optimalizálásához
   */
  trackByRdLine(index: number, rdline: RDLINE): string {
    return rdline.id || index.toString();
  }

  /**
   * Drag esemény kezelése
   */
  onDragDrop(event: CdkDragDrop<RDLINE[]>): void {
    // Drag & drop logika
  }

  /**
   * Cache invalidálása
   */
  invalidateCache(): void {
    this.dragDataCache.clear();
    this.lastCacheKey = '';
  }

  /**
   * Subject-ek cleanup
   */
  private cleanupSubjects(): void {
    this.contentSubject.complete();
    this.additionalContentSubject.complete();
    this.selectedRowsSubject.complete();
    this.filteredRdLinesSubject.complete();
  }

  /**
   * Teljesítmény riport generálása
   */
  getPerformanceReport(): string {
    return this.performanceMonitor.generateReport();
  }
}