import $ from "jquery";

// ToDo: titles
// gridlines
// There is no need to rerender every cell after scroll. Group cells by rows.
// We need to render only last row.

export interface IViewport {
  width: number;
  height: number;
}

export interface IMargins {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface GridHeader {
  size: number;
  render: (element: JQuery) => void;
}

export interface ICellRenderData {
  index: number;
  element: JQuery;
}

export interface GridSettings {
  rowCount: number;
  columnCount: number;
  // identifies how many cells total in the greed
  cellCount: number;
  viewPort: IViewport;
  renderCell: (data: ICellRenderData) => Promise<void>;
  footer?: GridHeader;
  left?: GridHeader;
  right?: GridHeader;
}

const ScrollSize: number = 20;

/**
 * Responsible for breaking viewport into multiple cells. 
 * All the headers and cell content is owned by the consumer.
 * Grid is responsible for deciding which cells is rendered and when
 * and also handling scrolling.
 * General structure is 
 * body
 *  row
 *    header
 *    cell[] - includes title, content
 *    footer
 * footer
 * It was designed to handle small multiples layout. 
 */
export class GridLayout {
  private headerMargins: IMargins;
  private renderer: GridRenderer;

  constructor(
    private readonly container: HTMLElement,
    private readonly settings: GridSettings
  ) {
    this.renderer = new GridRenderer($(container));
  }

  // if we make it asynchronouse we will need to handle properly
  // feedback when redering is done.
  public async render(): Promise<void> {
    this.updateHeaderMargins();
    let settings = this.calculateGridRenderSettings();
    this.renderer.render(settings);
  }

  private calculateGridRenderSettings(): GridRenderSettings {
    let viewPort = this.getCellDimensions(this.headerMargins);
    let cell: GridCell = {
      width: viewPort.width,
      renderCell: this.settings.renderCell
    };

    let gridRow: GridRow = {
      header: undefined,
      footer: undefined,
      cell: cell,
      height: viewPort.height,
      columnCount: this.settings.columnCount
    }

    let settings: GridRenderSettings  = {
      totalRowCount: Math.ceil(this.settings.cellCount / this.settings.rowCount),
      viewport: this.settings.viewPort,
      footer: this.settings.footer,
      rowCount: this.settings.rowCount,
      row: gridRow
    }
    
    return settings;
  }

  public destroy() {
    $(this.container).empty();
  }

  public calculateCellSize(margins: IMargins): IViewport {
    // In case for external calculation we should give the cell
    // size that chart will use to render.That does not include the title
    // even though it's actually part of the cell.
    return this.getCellDimensions(margins);
  }

  /**
   * In case of cartesian when we calculate axes we will need to recalculate viewport based on axes margins. We should expose this before the actual rendering is done.
   */
  private getCellDimensions(margins: IMargins): IViewport {
    let width =
      this.settings.viewPort.width -
      this.headerMargins.left -
      this.headerMargins.right;

    let height =
      this.settings.viewPort.height -
      this.headerMargins.top -
      this.headerMargins.bottom;

    if (this.hasScroll()) width -= ScrollSize;
    let cellWidth = width / this.settings.columnCount;
    let cellHeight = height / this.settings.rowCount;

    return {
      width: cellWidth,
      height: cellHeight
    };
  }

  private updateHeaderMargins() {
    this.headerMargins = {
      bottom: this.settings.footer ? this.settings.footer.size : 0,
      left: this.settings.left ? this.settings.left.size : 0,
      right: this.settings.right ? this.settings.right.size : 0,
      top: 0
    };
  }

  private hasScroll(): boolean {
    let totalRows = this.settings.cellCount / this.settings.columnCount;

    if (totalRows > this.settings.rowCount) return true;
  }

  private getTotalRows(): number {
    return Math.ceil(this.settings.cellCount / this.settings.columnCount);
  }
}

interface GridCell {
  width: number;
  renderCell: (data: ICellRenderData) => void;
  //ToDo add support for margins and title.
}

interface GridRow {
  columnCount: number;
  height: number;
  footer: GridHeader;
  header: GridHeader;
  cell: GridCell;
}

interface GridRenderSettings {
  viewport: IViewport;
  footer?: GridHeader;
  totalRowCount: number;
  rowCount: number;
  row: GridRow;
}

class GridRenderer {
  private grid: JQuery;
  private gridScrollWrapper: JQuery;
  private gridViewport: JQuery;
  private gridBody: JQuery;
  private gridFooter: JQuery;
  private settings: GridRenderSettings;
  // for lazy initialization
  private isInitialized: boolean = false;

  constructor(private readonly container: JQuery) {}

  public render(settings: GridRenderSettings): void {
    this.settings = settings;
    if (!this.isInitialized) this.initialize();

    let totalHeight = settings.totalRowCount & settings.row.height;
    // This makes sure that we properly show scroll area size.
    this.gridScrollWrapper.css("height", settings.viewport.height);

    this.updateFooter();
    //this.updateRows();
  }

  private updateFooter(): void {
    let gridFooter = this.settings.footer;
    if (!gridFooter) {
      this.gridFooter.hide();
      return;
    }
    // Clear exsting footer first.
    this.gridFooter.empty();

    let row = this.settings.row;
    // we need to keep headers though do not render any content there
    let rowFooter: GridHeader = undefined;
    if (row.footer)
      rowFooter = {
        size: row.footer.size,
        render: () => {}
      };

    let rowHeader = undefined;
    if (row.header)
      rowHeader = {
        size: row.header.size,
        // we should leave header cells empty in case of footer.
        render: () => {}
      };

    this.gridFooter.css("height", gridFooter.size);
    let footerRow: GridRow = {
      columnCount: row.columnCount,
      footer: rowFooter,
      header: rowHeader,
      height: gridFooter.size,
      cell: {
        width: row.cell.width,
        renderCell: (data: ICellRenderData) => {
          gridFooter.render(data.element);
        }
      }
    };

    this.renderRow(this.gridFooter, footerRow, 0);
  }

  private updateRows(): void {
    // remove all the existend rows.
    // this should account on scroll position and update rows
    // that are visible.
    this.gridBody.empty();

    let cellIndex = 0;
    // In future we will update only visible rows. As you scroll some rows
    // needs to be removed and some added.
    for (let i = 0; this.settings.totalRowCount; i++) {
      this.renderRow(this.gridBody, this.settings.row, cellIndex)
      cellIndex += this.settings.row.columnCount;
    }
  }

  private renderRow(element: JQuery, settings: GridRow, cellIndex: number): void {
    let row = this.buildElement(element, "grid-row");
    if (settings.header) {
      let headerCell = this.buildElement(row, "grid-cell");
      headerCell.css("width", settings.header.size);
      settings.header.render(headerCell);
    }

    for (let i = 0; i < settings.columnCount; i++) {
      // we do not need to control width because space will be equally distributed
      // between cells. This is going to be more complicated eventyally with title
      // margins ...

      //ToDo: support title, margin, customization.
      // We might need to have GridDataBinder to read data.
      let cell = this.buildElement(row, "grid-cell");
      debugger;
      settings.cell.renderCell({element: cell, index: cellIndex + i});
    }

    if (settings.footer) {
      let footerCell = this.buildElement(row, "grid-cell");
      footerCell.css("width", settings.footer.size);
      settings.footer.render(footerCell);
    }
  }

  private initialize() {
    let settings = this.settings;
    let viewport = settings.viewport;
    this.isInitialized = true;
    this.grid = this.buildElement(this.container, "grid");
    this.gridBody = this.buildElement(this.grid, "grid-body");
    this.gridFooter = this.buildElement(this.grid, "grid-footer");
    this.gridScrollWrapper = this.buildElement(this.grid,"grid-scroll-wrapper");
    this.gridBody = this.buildElement(this.gridScrollWrapper, "grid-body");
  }

  private buildElement(
    parent: JQuery,
    className: string,
    viewPort?: IViewport
  ): JQuery {
    let element = $("<div />")
      .addClass(className)
      .appendTo(parent);

    return element;
  }
}
