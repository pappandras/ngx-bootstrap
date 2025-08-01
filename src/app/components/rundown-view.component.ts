import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

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
  selector: 'app-rundown-view',
  templateUrl: './rundown-view.component.html',
  styleUrls: ['./rundown-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush // Kritikus optimalizáció!
})
export class RundownViewComponent implements OnInit, OnDestroy {
  content: Content | null = null;
  additionalContent: AdditionalContent = {};
  selectedRows: RDLINE[] = [];
  filteredRdLines: RDLINE[] = [];

  // Cache a drag data számára
  private dragDataCache = new Map<string, RundownDragData>();
  private lastContentUid: string = '';
  private lastSelectedRowsHash: string = '';

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Inicializálás
  }

  ngOnDestroy(): void {
    // Cache törlése
    this.dragDataCache.clear();
  }

  /**
   * Optimalizált getDragData függvény memoization és caching használatával
   */
  getDragData(rdline: RDLINE): RundownDragData {
    // Ellenőrizzük, hogy van-e érvényes cache
    const cacheKey = this.generateCacheKey(rdline);
    const cachedData = this.dragDataCache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    // Alapvető validációk
    if (!this.content || !this.content.docReference._attributes.UID || !this.additionalContent.rdFormat) {
      return null;
    }

    const _rdLines = this.content.RUNDOWN.BODY.RDLINE;
    const rdLines = Array.isArray(_rdLines) ? _rdLines : [_rdLines];

    let data = [rdline];
    if (this.selectedRows.length > 0 && this.selectedRows.includes(rdline)) {
      data = rdLines.filter(line => this.selectedRows.includes(line));
    }

    const dragData: RundownDragData = {
      sourceUid: this.content.docReference._attributes.UID,
      formatUid: this.additionalContent.rdFormat?.docReference?._attributes.UID,
      lines: data,
    };

    // Cache-eljük az eredményt
    this.dragDataCache.set(cacheKey, dragData);
    
    return dragData;
  }

  /**
   * Cache key generálása a drag data számára
   */
  private generateCacheKey(rdline: RDLINE): string {
    const contentUid = this.content?.docReference._attributes.UID || '';
    const selectedRowsHash = this.getSelectedRowsHash();
    const rdlineId = rdline.id || JSON.stringify(rdline);
    
    return `${contentUid}_${selectedRowsHash}_${rdlineId}`;
  }

  /**
   * Selected rows hash generálása gyors összehasonlításhoz
   */
  private getSelectedRowsHash(): string {
    if (this.selectedRows.length === 0) return 'empty';
    return this.selectedRows.map(row => row.id).sort().join('_');
  }

  /**
   * Cache invalidálása amikor a content vagy selected rows változik
   */
  invalidateCache(): void {
    const currentContentUid = this.content?.docReference._attributes.UID || '';
    const currentSelectedRowsHash = this.getSelectedRowsHash();

    if (this.lastContentUid !== currentContentUid || this.lastSelectedRowsHash !== currentSelectedRowsHash) {
      this.dragDataCache.clear();
      this.lastContentUid = currentContentUid;
      this.lastSelectedRowsHash = currentSelectedRowsHash;
    }
  }

  /**
   * Drag esemény kezelése
   */
  onDragDrop(event: CdkDragDrop<RDLINE[]>): void {
    // Drag & drop logika
  }

  /**
   * Track by függvény az *ngFor optimalizálásához
   */
  trackByRdLine(index: number, rdline: RDLINE): string {
    return rdline.id || index.toString();
  }
}