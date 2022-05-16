import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { last } from 'lodash'
import cx from 'classnames'
import { EuiButtonIcon } from '@elastic/eui'

import {
  fetchMoreStreamEntries,
  fetchStreamEntries,
  streamDataSelector,
  streamSelector,
} from 'uiSrc/slices/browser/stream'
import VirtualTable from 'uiSrc/components/virtual-table/VirtualTable'
import { ITableColumn } from 'uiSrc/components/virtual-table/interfaces'
import { selectedKeyDataSelector } from 'uiSrc/slices/browser/keys'
import { SCAN_COUNT_DEFAULT } from 'uiSrc/constants/api'
import { SortOrder } from 'uiSrc/constants'

import { StreamEntryDto } from 'apiSrc/modules/browser/dto/stream.dto'

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
  const {
    total,
    firstEntry,
    lastEntry,
  } = useSelector(streamDataSelector)
  const { name: key } = useSelector(selectedKeyDataSelector) ?? { name: '' }

  const [sortedColumnName, setSortedColumnName] = useState('id')
  const [sortedColumnOrder, setSortedColumnOrder] = useState(SortOrder.DESC)

  const loadMoreItems = () => {
    const lastLoadedEntryId = last(entries)?.id ?? ''
    const lastEntryId = sortedColumnOrder === SortOrder.ASC ? lastEntry?.id : firstEntry?.id

    if (lastLoadedEntryId && lastLoadedEntryId !== lastEntryId) {
      dispatch(
        fetchMoreStreamEntries(
          key,
          `${xrangeIdPrefix + lastLoadedEntryId}`,
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

  return (
    <>
      <div
        className={cx(
          'key-details-table',
          'stream-entries-container',
          styles.container,
          { footerOpened: isFooterOpen }
        )}
        data-test-id="stream-entries-container"
      >
        <div className={styles.columnManager}>
          <EuiButtonIcon iconType="boxesVertical" aria-label="manage columns" />
        </div>
        <VirtualTable
          selectable={false}
          keyName={key}
          headerHeight={headerHeight}
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
          sortedColumn={{
            column: sortedColumnName,
            order: sortedColumnOrder,
          }}
        />
      </div>
    </>
  )
}

export default StreamDetails