// Import stylesheets
import './style.css';
import './index.css';
import './gridLayout.css';

import { GridLayout, GridSettings, ICellRenderData, IViewport } from './gridLayout.component';
import $ from 'jquery';


let appDiv = document.getElementById('app');
let viewPort = document.createElement('div')
viewPort.classList.add('viewport');
appDiv.appendChild(viewPort)

let settings: GridSettings = {
  rowCount: 3,
  cellCount: 100,
  columnCount: 3,
  viewPort: {
    width: 500,
    height: 500
  },
  renderCell: renderUnsharedAxis,
  footer: {
      size: 20,
      render: renderFooter
  }
}

initializeSettings(settings);

$('input').on('change', () => {
  gridLayout.destroy();
  let settings = readSettings();

  $(viewPort).css({
    width: settings.viewPort.width + 20,
    height: settings.viewPort.height + 20
  });

  gridLayout = new GridLayout(viewPort, settings);
  gridLayout.render();
})

let gridLayout = new GridLayout(viewPort, settings);

// Initialize settings
gridLayout.render();

function renderUnsharedAxis(data: ICellRenderData): Promise<void> {
    let text = $('<span />').appendTo(data.element);
    text.text(`Cell ${data.rowIndex}-${data.columnIndex} CellIndex: ${data.index}`)

    return Promise.resolve();
}

function renderFooter(element: JQuery): void {
    let text = $('<span />').appendTo(element);
    text.text(`Footer`)
}

function initializeSettings(settings: GridSettings): void {
  $('#width').val(settings.viewPort.width)
  $('#height').val(settings.viewPort.height)
  $('#cCount').val(settings.columnCount)
  $('#rCount').val(settings.rowCount)
  $('#total').val(settings.cellCount)
}

function readSettings(): GridSettings {
  let width: number = Number.parseInt($('#width').val() as string);
  let height = Number.parseInt($('#height').val() as string);
  let cCount = Number.parseInt($('#cCount').val() as string);
  let rCount = Number.parseInt($('#rCount').val() as string);
  let total = Number.parseInt($('#total').val() as string);

  return {
    cellCount: total,
    rowCount: rCount,
    columnCount: cCount,
    viewPort: {
      width: width,
      height: height
    },
    renderCell: renderUnsharedAxis, 
    footer: {
      size: 20,
      render: renderFooter
    }
  }
}
