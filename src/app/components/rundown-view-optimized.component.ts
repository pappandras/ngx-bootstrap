import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, distinctUntilChanged, shareReplay } from 'rxjs/operators';

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
  selector: 'app-rundown-view-optimized',
  templateUrl: './rundown-view-optimized.component.html',
  styleUrls: ['./rundown-view-optimized.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RundownViewOptimizedComponent implements OnInit, OnDestroy, OnChanges {
  @Input() content: Content | null = null;
  @Input() additionalContent: AdditionalContent = {};
  @Input() selectedRows: RDLINE[] = [];
  @Input() filteredRdLines: RDLINE[] = [];

  // Observable-ok a reaktív programozáshoz
  private contentSubject = new BehaviorSubject<Content | null>(null);
  private additionalContentSubject = new BehaviorSubject<AdditionalContent>({});
  private selectedRowsSubject = new BehaviorSubject<RDLINE[]>([]);
  private filteredRdLinesSubject = new BehaviorSubject<RDLINE[]>([]);

  // Computed properties Observable-ként
  public dragDataMap$: Observable<Map<string, RundownDragData>>;

  constructor(private cdr: ChangeDetectorRef) {
    // Létrehozzuk a computed drag data map-et
    this.dragDataMap$ = combineLatest([
      this.contentSubject,
      this.additionalContentSubject,
      this.selectedRowsSubject,
      this.filteredRdLinesSubject
    ]).pipe(
      map(([content, additionalContent, selectedRows, filteredRdLines]) => {
        return this.computeDragDataMap(content, additionalContent, selectedRows, filteredRdLines);
      }),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  ngOnInit(): void {
    // Subscribe a drag data map-hez
    this.dragDataMap$.subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
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

  ngOnDestroy(): void {
    this.contentSubject.complete();
    this.additionalContentSubject.complete();
    this.selectedRowsSubject.complete();
    this.filteredRdLinesSubject.complete();
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
   * Drag data lekérése a map-ből
   */
  getDragData(rdline: RDLINE): RundownDragData | null {
    let result: RundownDragData | null = null;
    
    this.dragDataMap$.subscribe(dragDataMap => {
      const cacheKey = this.generateCacheKey(rdline, this.content?.docReference._attributes.UID || '', this.selectedRows);
      result = dragDataMap.get(cacheKey) || null;
    }).unsubscribe();

    return result;
  }

  /**
   * Track by függvény
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
}