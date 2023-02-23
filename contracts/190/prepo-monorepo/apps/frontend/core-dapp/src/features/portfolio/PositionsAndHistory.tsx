import { t } from '@lingui/macro'
import { Box, centered, media, spacingIncrement } from 'prepo-ui'
import { useState } from 'react'
import styled, { useTheme } from 'styled-components'
import FilterButton from '../../components/Filter/FilterButton'
import Tabs from '../../components/Tabs'
import History from '../history/History'
import Positions from '../position/Positions'

const StyledTabs = styled(Tabs)`
  &&&& {
    .ant-select-selection-item {
      padding-right: 20px;
    }

    .ant-select-selection-item,
    .ant-tabs-tab-btn {
      font-size: ${({ theme }): string => theme.fontSize.sm};
      ${media.desktop`
        font-size: ${({ theme }): string => theme.fontSize.md};
      `}
    }

    .ant-select-arrow {
      left: 100%;
      padding: 0 ${spacingIncrement(6)};
      transform: translate(-100%, -50%);
    }

    .ant-tabs-nav {
      border-bottom: solid 1px ${({ theme }): string => theme.color.accent1};
      flex-direction: column;
      margin-bottom: 0;
      ${media.desktop`
        flex-direction: row;
      `}
    }

    .ant-tabs-extra-content {
      ${media.desktop`
        width: auto;
        padding: 0 ${spacingIncrement(30)};
      `}
      align-items: flex-end;
      display: flex;
      justify-content: flex-end;
      padding: ${spacingIncrement(20)} ${spacingIncrement(37)};
      width: 100%;
    }

    .ant-tabs-tab {
      display: flex;
      flex: 1;
      padding: ${spacingIncrement(8)} 0;
      width: 100%;
      ${media.desktop`
        padding: ${spacingIncrement(12)} ${spacingIncrement(20)};
      `}
    }

    .ant-tabs-nav-list {
      display: grid;
      grid-template-columns: auto auto;
    }

    .ant-tabs-nav-list,
    .ant-tabs-tab,
    .ant-tabs-tab .ant-tabs-tab-active {
      ${centered}
      ${media.desktop`
        width: auto;
      `}
      width: 100%;
    }
  }
`

const PositionsAndHistory: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0)
  const { borderRadius } = useTheme()
  return (
    <Box
      border="1px solid"
      borderColor="neutral8"
      borderRadius={borderRadius.xs}
      mt={{ desktop: 32, mobile: 24 }}
      width="100%"
    >
      <StyledTabs
        disableMore
        tabBarExtraContent={activeTab === 1 && <FilterButton />}
        size="large"
        onChange={(e): void => setActiveTab(+e)}
        styles={{ activeColor: 'neutral1', color: 'neutral2' }}
        tab={[
          {
            heading: t`Positions`,
            content: <Positions />,
          },
          {
            heading: t`History`,
            content: <History />,
          },
        ]}
      />
    </Box>
  )
}

export default PositionsAndHistory
