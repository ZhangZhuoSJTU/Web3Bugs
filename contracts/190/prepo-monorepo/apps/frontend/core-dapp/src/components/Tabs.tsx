import { Tabs as ATabs, TabsProps } from 'antd'
import { ReactNode } from 'react'
import styled, { Color, Weight } from 'styled-components'
import { centered, spacingIncrement } from 'prepo-ui'

const { TabPane } = ATabs

type Tab = {
  heading: ReactNode
  content?: ReactNode
  value?: string | number
}

type TabStyles = {
  activeBackgroundColor?: keyof Color
  activeColor?: keyof Color
  activeTextWeight?: keyof Weight
  backgroundColor?: keyof Color
  borderColor?: keyof Color
  color?: keyof Color
  inkBarColor?: keyof Color
  height?: number
}

type Props = {
  disableMore?: boolean
  styles?: TabStyles
  tab: Tab[]
} & TabsProps

const Wrapper = styled.div<{ disableMore: boolean; styles: TabStyles }>`
  &&& {
    .ant-tabs-nav-more {
      ${({ disableMore }): string => (disableMore ? 'display: none;' : '')}
    }
    .ant-tabs-nav::before {
      border-bottom: 0px;
    }
    .ant-tabs-tab {
      color: ${({ styles, theme }): string => theme.color[styles.color || 'neutral4']};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
      opacity: 0.84;
      padding: ${spacingIncrement(7)} ${spacingIncrement(15)};
      margin: 0;
    }
    .ant-tabs-tab-btn {
      ${centered}
    }
    .ant-tabs-tab-active .ant-tabs-tab-btn {
      color: ${({ styles, theme }): string =>
        theme.color[styles.activeColor || 'tabActiveBackground']};
    }
    .ant-tabs-card .ant-tabs-tab {
      height: ${({ styles }): string => spacingIncrement(styles.height || 38)};
      border: 1px solid
        ${({ styles, theme }): string => theme.color[styles.borderColor || 'neutral7']};
      background-color: ${({ styles, theme }): string =>
        theme.color[styles.backgroundColor || 'neutral10']};
      border-radius: 0px;
      margin-left: 0px;
      color: ${({ styles, theme }): string => theme.color[styles.color || 'neutral1']};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
      font-size: ${({ theme }): string => theme.fontSize.xs};
      :first-child {
        border-top-left-radius: ${({ theme }): string => theme.boxRadiusPx};
        border-bottom-left-radius: ${({ theme }): string => theme.boxRadiusPx};
      }
      :nth-last-child(2) {
        border-top-right-radius: ${({ theme }): string => theme.boxRadiusPx};
        border-bottom-right-radius: ${({ theme }): string => theme.boxRadiusPx};
      }
    }
    .ant-tabs-card .ant-tabs-tab-active {
      background-color: ${({ styles, theme }): string =>
        theme.color[styles.activeBackgroundColor || 'tabActiveBackground']};
      .ant-tabs-tab-btn {
        color: ${({ styles, theme }): string => theme.color[styles.activeColor || 'white']};
      }
    }
    .ant-tabs-ink-bar {
      background: ${({ styles, theme }): string => theme.color[styles.inkBarColor || 'primary']};
      height: ${spacingIncrement(2)};
    }
  }
`

export const secondaryTabsStyles: TabStyles = {
  activeBackgroundColor: 'neutral7',
  activeColor: 'neutral1',
  backgroundColor: 'neutral10',
  borderColor: 'neutral7',
  inkBarColor: 'primary',
  height: 32,
}

const Tabs: React.FC<Props> = ({ styles = {}, disableMore = false, tab: data, ...props }) => (
  <Wrapper disableMore={disableMore} styles={styles}>
    {/* eslint-disable-next-line react/jsx-props-no-spreading */}
    <ATabs {...props}>
      {data.map(({ heading, content, value }, index) => (
        <TabPane tab={heading} key={value || index.toString()}>
          {content}
        </TabPane>
      ))}
    </ATabs>
  </Wrapper>
)

export default Tabs
