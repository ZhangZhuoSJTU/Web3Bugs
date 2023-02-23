import { Layout as ALayout } from 'antd'
import styled from 'styled-components'
import { media, spacingIncrement } from 'prepo-ui'
import Header from './Header'

const Wrapper = styled.div`
  &&& {
    .ant-layout {
      background-color: ${({ theme }): string => theme.color.neutral10};
      min-height: 100vh;
      .ant-layout-content {
        flex: 1;
        padding: ${spacingIncrement(32)};
        padding-bottom: ${spacingIncrement(96)};
        ${media.desktop`
          padding: ${spacingIncrement(64)};
          padding-top: ${spacingIncrement(22)};
        `}
      }
    }
  }
`

//! Will need to make sure if <Navigation /> will be rendered in all the components?
const Layout: React.FC = ({ children }) => (
  <Wrapper>
    <ALayout>
      <Header />
      <ALayout.Content>{children}</ALayout.Content>
    </ALayout>
  </Wrapper>
)

export default Layout
