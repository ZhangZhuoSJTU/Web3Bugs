import styled from 'styled-components'
import ToggleTheme from './ToggleTheme'
import ConnectButton from '../features/connect/ConnectButton'
import NetworkBox from '../features/connect/NetworkBox'

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  font-weight: ${({ theme }): number => theme.fontWeight.extraBold};
  height: 100%;
  justify-content: flex-end;
`

const Navigation: React.FC = () => (
  <Wrapper>
    <NetworkBox />
    <ConnectButton />
    <ToggleTheme />
  </Wrapper>
)

export default Navigation
