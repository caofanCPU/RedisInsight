import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { last, isNull, map } from 'lodash'
import cx from 'classnames'
import { EuiButtonIcon, EuiProgress } from '@elastic/eui'
import { GridCellProps } from 'react-virtualized'

import {
  fetchMoreStreamEntries,
  fetchStreamEntries,
  streamDataSelector,
  streamSelector,
  streamRangeSelector,
} from 'uiSrc/slices/browser/stream'
import { ITableColumn } from 'uiSrc/components/virtual-table/interfaces'
import { selectedKeyDataSelector } from 'uiSrc/slices/browser/keys'
import { SCAN_COUNT_DEFAULT } from 'uiSrc/constants/api'
import { SortOrder } from 'uiSrc/constants'
import { getTimestampFromId } from 'uiSrc/utils/streamUtils'
import { StreamEntryDto } from 'apiSrc/modules/browser/dto/stream.dto'
import { VirtualTableGrid } from 'uiSrc/components'
import StreamRangeFilter from './StreamRangeFilter'

import styles from './styles.module.scss'

const headerHeight = 60
const rowHeight = 54
const actionsWidth = 54
const minColumnWidth = 190
const xrangeIdPrefix = '('
const noItemsMessageString = 'There are no Entries in the Stream.'

interface IStreamEntry extends StreamEntryDto {
  editing: boolean
}

export interface Props {
  data: IStreamEntry[]
  columns: ITableColumn[]
  onEditEntry: (entryId:string, editing: boolean) => void
  onClosePopover: () => void
  isFooterOpen?: boolean
}

const StreamDetails = (props: Props) => {
  const { data: entries = [], columns = [], onClosePopover, isFooterOpen } = props
  const dispatch = useDispatch()

  const { loading } = useSelector(streamSelector)
  const { start, end } = useSelector(streamRangeSelector)
  const {
    total,
    firstEntry,
    lastEntry,
  } = useSelector(streamDataSelector)
  const { name: key } = useSelector(selectedKeyDataSelector) ?? { name: '' }

  const shouldFilterRender = !isNull(firstEntry) && (firstEntry.id !== '') && !isNull(lastEntry) && lastEntry.id !== ''

  const [sortedColumnName, setSortedColumnName] = useState<string>('id')
  const [sortedColumnOrder, setSortedColumnOrder] = useState<SortOrder>(SortOrder.DESC)

  const loadMoreItems = () => {
    const lastLoadedEntryId = last(entries)?.id
    const lastLoadedEntryTimeStamp = getTimestampFromId(lastLoadedEntryId)

    const lastRangeEntryTimestamp = end ? parseInt(end, 10) : getTimestampFromId(lastEntry?.id)
    const firstRangeEntryTimestamp = start ? parseInt(start, 10) : getTimestampFromId(firstEntry?.id)
    const shouldLoadMore = () => {
      if (!lastLoadedEntryTimeStamp) {
        return false
      }
      return sortedColumnOrder === SortOrder.ASC
        ? lastLoadedEntryTimeStamp > lastRangeEntryTimestamp
        : lastLoadedEntryTimeStamp < firstRangeEntryTimestamp
    }
    const previousLoadedString = `${xrangeIdPrefix + lastLoadedEntryId}`

    if (shouldLoadMore()) {
      dispatch(
        fetchMoreStreamEntries(
          key,
          sortedColumnOrder === SortOrder.DESC ? start : previousLoadedString,
          sortedColumnOrder === SortOrder.DESC ? previousLoadedString : end,
          SCAN_COUNT_DEFAULT,
          sortedColumnOrder,
        )
      )
    }
  }

  const onChangeSorting = (column: any, order: SortOrder) => {
    setSortedColumnName(column)
    setSortedColumnOrder(order)

    dispatch(fetchStreamEntries(key, SCAN_COUNT_DEFAULT, order))
  }

  const GridColumn = ({ rowIndex, columnIndex, style }: GridCellProps) => {
    const fieldId = columns[columnIndex]?.id

    return (
      <div className="sticky-grid__data__column" style={style}>
        {/* {fieldId !== 'actions' ? entries[rowIndex]?.fields?.[fieldId] : '' } */}
        {columns?.[columnIndex + 1]?.render?.(entries[rowIndex]?.fields?.[fieldId], entries[rowIndex]) }
      </div>
    )
  }

  return (
    <>
      {shouldFilterRender ? (
        <StreamRangeFilter sortedColumnOrder={sortedColumnOrder} />
      )
        : (
          <div className={styles.rangeWrapper}>
            <div className={cx(styles.sliderTrack, styles.mockRange)} />
          </div>
        )}
      <div
        className={cx(
          'key-details-table',
          'stream-entries-container',
          styles.container,
          { footerOpened: isFooterOpen }
        )}
        data-test-id="stream-entries-container"
      >
        {loading && (
          <EuiProgress
            color="primary"
            size="xs"
            position="absolute"
            data-testid="progress-key-stream"
          />
        )}
        {/* <div className={styles.columnManager}>
          <EuiButtonIcon iconType="boxesVertical" aria-label="manage columns" />
        </div> */}
        {/* <VirtualTable
          hideProgress
          selectable={false}
          keyName={key}
          headerHeight={entries?.length ? headerHeight : 0}
          rowHeight={rowHeight}
          columns={columns}
          footerHeight={0}
          loadMoreItems={loadMoreItems}
          loading={loading}
          items={entries}
          totalItemsCount={total}
          onWheel={onClosePopover}
          onChangeSorting={onChangeSorting}
          noItemsMessage={noItemsMessageString}
          tableWidth={columns.length * minColumnWidth - actionsWidth}
          sortedColumn={entries?.length ? {
            column: sortedColumnName,
            order: sortedColumnOrder,
          } : undefined}
        /> */}
        <VirtualTableGrid
          columnCount={columns.length - 1}
          rowCount={entries.length}
          rowHeight={30}
          columnWidth={minColumnWidth}
          stickyHeight={50}
          totalItemsCount={total}
          stickyWidth={minColumnWidth}
          loadMoreItems={loadMoreItems}
          columns={columns}
          firstColumnData={map(entries, 'id')}
        >
          {GridColumn}
        </VirtualTableGrid>
      </div>
    </>
  )
}

export default StreamDetails
