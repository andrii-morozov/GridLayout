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
}

export interface GridHeader {
  size: number;
  render: () => void
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
  renderCell: (data: ICellRenderData) => Promise<IViewport>;
  footer?: GridHeader;
  left?: GridHeader;
  right?: GridHeader;
  
}

export class GridLayout {
  private grid: JQuery;
  private margins: IMargins;
  // used to calculate scroll position.
  private currentRowIndex: number;
  private gridCellContainer: JQuery;
  private gridScrollWrapper: JQuery;

  private scrollTop: number = 0;
  private isRendering = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly settings: GridSettings
  ) {
    this.currentRowIndex = 0;
    // We will read settings from objects.
    // Actually the same will happen for row/columns count.
    this.margins = {
      top: 10,
      left: 10
    };
  }

  // if we make it asynchronouse we will need to handle properly
  // feedback when redering is done.
  public async render(): Promise<void> {
    if (!this.grid) {
      this.grid = $("<div />");
      this.grid
        .addClass("grid")
        .css({
          width: this.settings.viewPort.width,
          height: this.settings.viewPort.height
        })
        .appendTo(this.container)
        .on("scroll", (event: JQueryEventObject) => {
          this.onScroll(event);
          return false;
        });
      this.gridScrollWrapper = $("<div />");
      this.gridScrollWrapper
        .appendTo(this.grid)
        .addClass("grid-scroll-wrapper");

      this.gridCellContainer = $("<div />");
      this.gridCellContainer
        .appendTo(this.gridScrollWrapper)
        .addClass("grid-cell-container");
    }

    this.gridCellContainer.css({
      width: !this.hasScroll()
        ? this.settings.viewPort.width
        : this.settings.viewPort.width - 20,
      height: this.settings.viewPort.height
    });

    this.updateScrollPosition();

    await this.renderCells();
  }

  public destroy(): void {
    this.grid.remove();
  }

  /**
   * In case of cartesian when we calculate axes we will need to recalculate viewport based on axes margins. We should expose this before the actual rendering is done.
   */
  public getCellDimensions(viewPort: IViewport): IViewport {
    let marginLeft = this.margins.left * (this.settings.columnCount + 1);
    let totalMarginTop = this.margins.top * (this.settings.rowCount + 1);
    let totalWidth = this.settings.viewPort.width - marginLeft;
    if (this.hasScroll()) totalWidth -= 20;
    let width = totalWidth / this.settings.columnCount;
    let height =
      (this.settings.viewPort.height - totalMarginTop) / this.settings.rowCount;

    // reduce view port based on
    if (this.hasScroll()) width -= 10;

    return {
      width: width,
      height: height
    };
  }

  private onScroll(event: JQueryEventObject) {
    if (this.isRendering) return;

    this.isRendering = true;
    event.preventDefault();
    event.stopPropagation();

    window.requestAnimationFrame(() => {
      console.log(this.grid.scrollTop(), this.scrollTop);
      // the case when we setting scroll overselves
      // Chrome rouns scroll top values.
      if (Math.abs(this.grid.scrollTop() - this.scrollTop) < 1) {
        this.isRendering = false;
        return;
      }

      this.grid.css({
        overflow: "hidden"
      });

      if (this.grid.scrollTop() > this.scrollTop) this.currentRowIndex++;
      else this.currentRowIndex--;

      //ToDo: We should not empty the whole container.
      this.gridCellContainer.empty();
      this.render();

      this.grid.css({
        "overflow-y": "scroll"
      });
      this.isRendering = false;
    });
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

  private async renderCells(): Promise<void> {
    let viewPort = this.getCellDimensions(this.settings.viewPort);
    let y = this.margins.top;
    let x = this.margins.left;
    for (let i = 0; i < this.settings.rowCount; i++) {
      let x = this.margins.left;
      for (let k = 0; k < this.settings.columnCount; k++) {
        let cell = this.buildCell(y, x, viewPort);
        this.gridCellContainer.append(cell);
        let requridViewPort = await this.settings.renderCell({
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

    this.scrollTop = rowHeight * this.currentRowIndex;
    this.grid.scrollTop(this.scrollTop);
    this.gridCellContainer.css({
      transform: `translate(0, ${rowHeight * this.currentRowIndex}px)`
    });

    this.gridScrollWrapper.css({
      height: height
    });
  }

  private getTotalRows(): number {
    return Math.ceil(this.settings.cellCount / this.settings.columnCount);
  }

  private getCellIndex(row: number, column: number): number {
    return (this.currentRowIndex + row) * this.settings.columnCount + column;
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
