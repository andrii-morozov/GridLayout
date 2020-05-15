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
  rowIndex: number;
  columnIndex: number;
  index: number;
  viewPort: IViewport;
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

export class GridLayout {
  private grid: JQuery;
  private margins: IMargins;
  // used to calculate scroll position.
  private currentCellIndex: number;
  private gridCellContainer: JQuery;
  // ToDo: reuse some of the existing scroll mechanisms.
  private gridScrollWrapper: JQuery;
  private gridFooter: JQuery;

  private scrollTop: number = 0;
  private isRendering = false;
  private headerMargins: IMargins;

  constructor(
    private readonly container: HTMLElement,
    private readonly settings: GridSettings
  ) {
    this.currentCellIndex = 0;
    // We will read settings from objects.
    // Actually the same will happen for row/columns count.
    this.margins = {
      top: 10,
      left: 10,
      bottom: 0,
      right: 0
    };
  }

  // if we make it asynchronouse we will need to handle properly
  // feedback when redering is done.
  public async render(): Promise<void> {
    if (!this.grid) {
      // lazy initialiation. Only when we need it.
      this.initGridLayout();
    }

    this.gridCellContainer.css({
      width: !this.hasScroll()
        ? this.settings.viewPort.width
        : this.settings.viewPort.width - 20,
      height: this.settings.footer
        ? this.settings.viewPort.height - this.settings.footer.size
        : this.settings.viewPort.height
    });

    this.updateScrollPosition();
    this.renderFooter();
    await this.renderCells();
  }

  private initGridLayout() {
    this.grid = $("<div />");
    this.grid
      .addClass("grid")
      .css({
        width: this.settings.viewPort.width,
        height: this.settings.viewPort.height
      })
      .appendTo(this.container);
    
    let gridBody = $("<div />")
      .addClass("grid-body")
      .appendTo(this.grid);
    
    this.gridScrollWrapper = $("<div />");
    this.gridScrollWrapper.appendTo(gridBody).addClass("grid-scroll-wrapper");

    this.gridCellContainer = $("<div />");
    this.gridCellContainer
      .appendTo(this.gridScrollWrapper)
      .addClass("grid-cell-container");
  }

  public destroy(): void {
    this.grid.remove();
  }

  public calculateCellSize(margins: IMargins): number {
    // In case for external calculation we should give the cell
    // size that chart will use to render.That does not include the title
    // even though it's actually part of the cell.
    return this.getCellDimensions(margins, false);
  }

  /**
   * In case of cartesian when we calculate axes we will need to recalculate viewport based on axes margins. We should expose this before the actual rendering is done.
   */
  private getCellDimensions(
    margins: IMargins,
    includeTitle: boolean
  ): IViewport {
    let width =
      this.settings.viewPort.width -
      this.headerMargins.left -
      this.headerMargins.right;

    let height =
      this.settings.viewPort.height -
      this.headerMargins.top -
      this.headerMargins.bottom;

    let totalXMargin = this.margins.left * (this.settings.columnCount + 1);
    let totalYMargin = this.margins.top * (this.settings.rowCount + 1);
    width = width - totalXMargin;
    if (this.hasScroll()) width -= 20;
    let cellWidth = width / this.settings.columnCount;
    let cellHeight = (height - totalYMargin) / this.settings.rowCount;

    return {
      width: cellWidth,
      height: cellHeight
    };
  }

  private calculateTitleHeight(): number {
    return 0;
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

  private calculateGridHeight(): number {
    if (!this.hasScroll()) return this.settings.viewPort.height;

    let rowHeight = this.settings.viewPort.height / this.settings.rowCount;
    let totalRows = Math.ceil(
      this.settings.cellCount / this.settings.columnCount
    );

    return totalRows * rowHeight;
  }

  private renderFooter() {
    if (!this.settings.footer) return;

    if (!this.gridFooter) {
      this.gridFooter = $("<div />")
        .css("height", this.settings.footer.size)
        .css("width", this.settings.viewPort.width)
        .addClass("grid-footer")
        .appendTo(this.grid);
    }

    let viewPort = this.getCellDimensions(this.headerMargins, true);
    viewPort.height = this.settings.footer.size;
    let y = 0;
    let x = this.margins.left;
    for (let i = 0; i < this.settings.columnCount; i++) {
      let x = this.margins.left;
      let cell = this.buildCell(y, x, viewPort);
      cell.appendTo(this.gridFooter);
      this.settings.footer.render(cell);
      x += viewPort.width + this.margins.left;
    }
  }

  private async renderCells(): Promise<void> {
    let viewPort = this.getCellDimensions(this.headerMargins, true);
    let y = this.margins.top;
    let x = this.margins.left;
    for (let i = 0; i < this.settings.rowCount; i++) {
      let x = this.margins.left;
      for (let k = 0; k < this.settings.columnCount; k++) {
        let cell = this.buildCell(y, x, viewPort);
        this.gridCellContainer.append(cell);
        await this.settings.renderCell({
          rowIndex: i,
          columnIndex: k,
          index: this.getCellIndex(i, k),
          viewPort: viewPort,
          element: cell
        });

        x += viewPort.width + this.margins.left;
      }

      y += viewPort.height + this.margins.top;
    }
  }

  private updateScrollPosition(): void {
    let rowHeight = this.settings.viewPort.height / this.settings.rowCount;
    let totalRows = this.getTotalRows();
    let height = totalRows * rowHeight;

    this.scrollTop = rowHeight * this.currentCellIndex;
    this.grid.scrollTop(this.scrollTop);
    this.gridCellContainer.css({
      transform: `translate(0, ${rowHeight * this.currentCellIndex}px)`
    });

    this.gridScrollWrapper.css({
      height: height
    });
  }

  private getTotalRows(): number {
    return Math.ceil(this.settings.cellCount / this.settings.columnCount);
  }

  private getCellIndex(row: number, column: number): number {
    return (
      (this.getCurrentRowIndex() + row) * this.settings.columnCount + column
    );
  }

  private getCurrentRowIndex(): number {
    return Math.floor((this.currentCellIndex + 1) / this.settings.columnCount);
  }

  private buildCell(y: number, x: number, viewPort: IViewport): JQuery {
    let cell = $("<div />").addClass("grid-cell");

    cell.css({
      width: viewPort.width,
      height: viewPort.height,
      top: y,
      left: x
    });

    return cell;
  }
}
