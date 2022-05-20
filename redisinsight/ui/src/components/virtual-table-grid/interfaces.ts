import { ReactNode } from 'react'
import {
  SortOrder,
  TableCellAlignment,
  TableCellTextAlignment,
} from 'uiSrc/constants'

export interface IColumnSearchState {
  initialSearchValue?: string
  id: string
  value: string
  prependSearchName: string
  isOpened: boolean
  staySearchAlwaysOpen: boolean
  searchValidation?: (value: string) => string
}

export interface IResizeEvent {
  width: number,
  height: number,
}

export interface ITableColumn {
  id: string
  label: string | ReactNode
  minWidth?: number
  maxWidth?: number
  isSortable?: boolean
  isSearchable?: boolean
  isSearchOpen?: boolean
  initialSearchValue?: string
  headerClassName?: string
  headerCellClassName?: string
  truncateText?: boolean
  relativeWidth?: number
  absoluteWidth?: number | string
  alignment?: TableCellAlignment
  textAlignment?: TableCellTextAlignment
  render?: (cellData?: any, columnItem?: any) => any
  className?: string
  prependSearchName?: string
  staySearchAlwaysOpen?: boolean
  searchValidation?: (value: string) => string
}

export interface IProps {
  loading: boolean
  scanned?: number
  columns: ITableColumn[]
  loadMoreItems?: (config: any) => void
  rowHeight?: number
  footerHeight?: number
  selectable?: boolean
  keyName?: string
  headerHeight?: number
  searching?: boolean
  onRowClick?: (rowData: any) => void
  onSearch?: (newState: any) => void
  onWheel?: (event: React.WheelEvent) => void
  onChangeSorting?: (cellData?: any, columnItem?: any) => void
  items?: any
  noItemsMessage?: string | string[] | JSX.Element
  totalItemsCount?: number
  selectedKey?: any
  sortedColumn?: ISortedColumn
  disableScroll?: boolean
  setScrollTopPosition?: (position: number) => void
  scrollTopProp?: number
  hideFooter?: boolean
  tableWidth?: number
  hideProgress?: boolean
}

export interface ISortedColumn {
  column: string
  order: SortOrder
}
