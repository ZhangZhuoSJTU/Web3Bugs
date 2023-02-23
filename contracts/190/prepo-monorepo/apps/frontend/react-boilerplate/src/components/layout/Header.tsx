import { Layout } from 'antd'
import Navigation from '../Navigation'

const { Header: AHeader } = Layout

const Header: React.FC = () => (
  <AHeader>
    <Navigation />
  </AHeader>
)
export default Header
