import React from 'react'
import { mock, instance } from 'ts-mockito'

import { SortOrder } from 'uiSrc/constants'
import { fireEvent, render, screen } from 'uiSrc/utils/test-utils'

import { SCAN_COUNT_DEFAULT } from 'uiSrc/constants/api'
import VirtualGrid from './VirtualTableGrid'
import { IProps, ITableColumn } from './interfaces'

const mockedProps = mock<IProps>()

const columns: ITableColumn[] = [
  {
    id: 'name',
    label: 'Member',
    isSearchable: true,
    staySearchAlwaysOpen: true,
    initialSearchValue: '',
    truncateText: true,
  },
]

const sortedColumn = {
  column: 'name',
  order: SortOrder.ASC,
}

const members = ['member1', 'member2']

describe('VirtualTable', () => {
  it('should render with empty rows', () => {
    expect(
      render(
        <VirtualGrid
          {...instance(mockedProps)}
          items={[]}
          columns={columns}
          loading={false}
          loadMoreItems={jest.fn()}
          totalItemsCount={members.length}
        />
      )
    ).toBeTruthy()
  })

  it('should render rows', () => {
    expect(
      render(
        <VirtualGrid
          {...instance(mockedProps)}
          items={members}
          columns={columns}
          loading={false}
          loadMoreItems={jest.fn()}
          totalItemsCount={members.length}
        />
      )
    ).toBeTruthy()
  })

  it('should render search', () => {
    render(
      <VirtualGrid
        {...instance(mockedProps)}
        items={members}
        columns={columns}
        loading={false}
        loadMoreItems={jest.fn()}
        totalItemsCount={members.length}
      />
    )
    const searchInput = screen.getByTestId('search')
    expect(searchInput).toBeInTheDocument()
  })

  it('should open search clicked by search button', () => {
    const updatedColumns = [
      {
        ...columns[0],
        staySearchAlwaysOpen: false,
      },
    ]
    render(
      <VirtualGrid
        {...instance(mockedProps)}
        items={members}
        columns={updatedColumns}
        loading={false}
        loadMoreItems={jest.fn()}
        totalItemsCount={members.length}
      />
    )
    const searchInput = screen.getByTestId('search')
    expect(searchInput).not.toBeVisible()
    const searchButton = screen.getByTestId('search-button')
    fireEvent(
      searchButton,
      new MouseEvent('click', {
        bubbles: true,
      })
    )
    expect(searchInput).toBeVisible()
  })

  it('should call sort column', () => {
    const updatedColumns = [
      {
        ...columns[0],
        isSortable: true,
        isSearchable: false,
      },
    ]
    const onChangeSorting = jest.fn()
    const { container } = render(
      <VirtualGrid
        {...instance(mockedProps)}
        items={members}
        columns={updatedColumns}
        loading={false}
        loadMoreItems={jest.fn()}
        totalItemsCount={members.length}
        sortedColumn={sortedColumn}
        onChangeSorting={onChangeSorting}
      />
    )

    fireEvent(
      container.querySelector('.headerButtonSorted') as Element,
      new MouseEvent('click', {
        bubbles: true,
      })
    )

    expect(onChangeSorting).toBeCalled()
  })

  it('should call onRowClick by clicking row', () => {
    const onRowClick = jest.fn()
    render(
      <VirtualGrid
        {...instance(mockedProps)}
        items={members}
        columns={columns}
        loading={false}
        loadMoreItems={jest.fn()}
        totalItemsCount={members.length}
        onRowClick={onRowClick}
      />
    )
    const firstRow = screen.getAllByLabelText(/row/)[0]
    fireEvent(
      firstRow,
      new MouseEvent('click', {
        bubbles: true,
      })
    )

    expect(onRowClick).toBeCalled()
  })

  describe('Scan more', () => {
    const scanMoreBtnId = 'scan-more'

    it('Scan more button should be in the document when total > scanned', () => {
      const { queryByTestId } = render(
        <VirtualGrid
          {...instance(mockedProps)}
          items={[]}
          columns={[]}
          scanned={20}
          totalItemsCount={100}
        />
      )
      const scanMoreBtn = queryByTestId(scanMoreBtnId)

      expect(scanMoreBtn).toBeInTheDocument()
    })
    it('Scan more button should no be in the document when total == scanned', () => {
      const { queryByTestId } = render(
        <VirtualGrid
          {...instance(mockedProps)}
          items={[]}
          columns={[]}
          scanned={100}
          totalItemsCount={100}
        />
      )
      const scanMoreBtn = queryByTestId(scanMoreBtnId)

      expect(scanMoreBtn).not.toBeInTheDocument()
    })

    it('Scan more button should call loadMoreItems with arguments', () => {
      const onLoadMoreItems = jest.fn()

      const argMock = {
        stopIndex: SCAN_COUNT_DEFAULT - 1,
        startIndex: 0,
      }

      render(
        <VirtualGrid
          {...instance(mockedProps)}
          {...argMock}
          items={[]}
          columns={[]}
          loadMoreItems={onLoadMoreItems}
          scanned={20}
          totalItemsCount={100}
        />
      )
      const scanMoreBtn = screen.getByTestId(scanMoreBtnId)

      fireEvent(
        scanMoreBtn,
        new MouseEvent('click', {
          bubbles: true,
        })
      )

      expect(scanMoreBtn).toBeInTheDocument()
      expect(onLoadMoreItems).toBeCalledWith(argMock)
    })
  })
})
