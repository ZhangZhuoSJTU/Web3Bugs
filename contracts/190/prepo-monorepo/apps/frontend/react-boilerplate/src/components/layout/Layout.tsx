import styled from 'styled-components'
import { Layout as ALayout } from 'antd'
import Header from './Header'
import Footer from './Footer'

const { Content } = ALayout

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`

export const InnerWrapper = styled.div`
  background: ${({ theme }): string => theme.color.primaryBackground};
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`

export const MainContent = styled(Content)``

const Layout: React.FC = ({ children }) => (
  <Wrapper>
    <ALayout>
      <Header />
      <InnerWrapper>
        <MainContent>{children}</MainContent>
      </InnerWrapper>
      <Footer />
    </ALayout>
  </Wrapper>
)

export default Layout
