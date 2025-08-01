# Angular Teljesítmény Optimalizálási Útmutató

## 1. A Probléma Elemzése

### Eredeti Kód Problémái:
```typescript
getDragData(rdline: RDLINE): RundownDragData {
    console.log('>>>>>>>>>>>>>>> gatdragdata');
    // Minden hívásnál új objektum létrehozása
    return {
        sourceUid: this.content.docReference._attributes.UID,
        formatUid: this.additionalContent.rdFormat?.docReference?._attributes.UID,
        lines: data,
    };
}
```

**Problémák:**
- Minden change detection ciklusban többször lefut
- Minden alkalommal új objektumot hoz létre
- Nincs caching vagy memoization
- 34 elem × 6-8 hívás = 204-272 hívás/change detection ciklus

## 2. Optimalizációs Megoldások

### 2.1 Memoization és Caching
```typescript
private dragDataCache = new Map<string, RundownDragData>();

getDragData(rdline: RDLINE): RundownDragData {
    const cacheKey = this.generateCacheKey(rdline);
    const cachedData = this.dragDataCache.get(cacheKey);
    
    if (cachedData) {
        return cachedData; // Cache hit!
    }
    
    // Csak akkor számoljuk ki, ha nincs cache-ben
    const dragData = this.computeDragData(rdline);
    this.dragDataCache.set(cacheKey, dragData);
    return dragData;
}
```

### 2.2 Change Detection Strategy Optimalizálás
```typescript
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush // Kritikus!
})
```

### 2.3 TrackBy Függvény Használata
```html
<div *ngFor="let rdline of filteredRdLines; trackBy: trackByRdLine">
```

```typescript
trackByRdLine(index: number, rdline: RDLINE): string {
    return rdline.id || index.toString();
}
```

### 2.4 Computed Properties és Reactive Programming
```typescript
public dragDataMap$: Observable<Map<string, RundownDragData>>;

constructor() {
    this.dragDataMap$ = combineLatest([
        this.contentSubject,
        this.selectedRowsSubject
    ]).pipe(
        map(([content, selectedRows]) => 
            this.computeDragDataMap(content, selectedRows)
        ),
        distinctUntilChanged(),
        shareReplay(1)
    );
}
```

## 3. Teljesítmény Monitoring

### 3.1 Performance Monitor Service
```typescript
@Injectable()
export class PerformanceMonitorService {
    measure<T>(functionName: string, fn: () => T): T {
        const timerId = this.startTimer(functionName);
        try {
            return fn();
        } finally {
            this.endTimer(timerId, functionName);
        }
    }
}
```

### 3.2 Használat
```typescript
getDragData(rdline: RDLINE): RundownDragData {
    return this.performanceMonitor.measure('getDragData', () => {
        // Optimalizált implementáció
    });
}
```

## 4. További Optimalizációs Technikák

### 4.1 Virtual Scrolling
```typescript
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
    template: `
        <cdk-virtual-scroll-viewport itemSize="50">
            <div *cdkVirtualFor="let rdline of filteredRdLines">
                <!-- Row content -->
            </div>
        </cdk-virtual-scroll-viewport>
    `
})
```

### 4.2 OnPush Change Detection
```typescript
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyComponent {
    constructor(private cdr: ChangeDetectorRef) {}
    
    updateData() {
        // Immutable update
        this.data = [...this.data, newItem];
        this.cdr.markForCheck(); // Explicit trigger
    }
}
```

### 4.3 Pure Pipes
```typescript
@Pipe({
    name: 'dragData',
    pure: true // Csak akkor fut le, ha a paraméterek változnak
})
export class DragDataPipe implements PipeTransform {
    transform(rdline: RDLINE, content: Content): RundownDragData {
        // Pure function - csak a paraméterektől függ
    }
}
```

### 4.4 Lazy Loading
```typescript
const routes: Routes = [
    {
        path: 'rundown',
        loadChildren: () => import('./rundown/rundown.module').then(m => m.RundownModule)
    }
];
```

### 4.5 Web Workers
```typescript
// main.ts
if (typeof Worker !== 'undefined') {
    const worker = new Worker('./app.worker', { type: 'module' });
    worker.onmessage = ({ data }) => {
        console.log('Worker result:', data);
    };
}
```

## 5. Teljesítmény Mérési Eszközök

### 5.1 Angular DevTools
- Change Detection Profiler
- Component Tree
- Performance Timeline

### 5.2 Chrome DevTools
- Performance tab
- Memory tab
- Network tab

### 5.3 Lighthouse
```bash
npm install -g lighthouse
lighthouse https://your-app.com --view
```

## 6. Best Practices

### 6.1 Template Optimalizálás
```html
<!-- Rossz -->
<div *ngFor="let item of items">
    <span>{{ expensiveFunction(item) }}</span>
</div>

<!-- Jó -->
<div *ngFor="let item of items">
    <span>{{ item.computedValue }}</span>
</div>
```

### 6.2 Service Optimalizálás
```typescript
@Injectable({
    providedIn: 'root'
})
export class DataService {
    private cache = new Map<string, any>();
    
    getData(id: string): Observable<any> {
        if (this.cache.has(id)) {
            return of(this.cache.get(id));
        }
        
        return this.http.get(`/api/data/${id}`).pipe(
            tap(data => this.cache.set(id, data))
        );
    }
}
```

### 6.3 Memory Management
```typescript
export class MyComponent implements OnDestroy {
    private destroy$ = new Subject<void>();
    
    ngOnInit() {
        this.dataService.getData()
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                // Handle data
            });
    }
    
    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
```

## 7. Teljesítmény Metrikák

### 7.1 Kritikus Metrikák
- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **First Input Delay (FID)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1

### 7.2 Angular Specifikus Metrikák
- Change Detection Cycles: < 100ms
- Component Initialization: < 50ms
- Template Rendering: < 16ms (60 FPS)

## 8. Összefoglalás

A teljesítmény optimalizálás kulcsai:

1. **Memoization és Caching** - Kerüld el a felesleges számításokat
2. **OnPush Change Detection** - Csak akkor futtasd a change detection-t, amikor szükséges
3. **TrackBy Functions** - Segítsd az Angular-t a DOM frissítésekben
4. **Virtual Scrolling** - Nagy listákhoz
5. **Lazy Loading** - Csak akkor töltsd be, amikor kell
6. **Performance Monitoring** - Mérj és optimalizálj folyamatosan

Ezekkel a technikákkal a 2400 hívás/change detection ciklusból 0-ra csökkentheted a felesleges számításokat!