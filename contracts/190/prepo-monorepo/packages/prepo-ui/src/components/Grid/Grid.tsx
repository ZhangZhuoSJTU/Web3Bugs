import { grid, GridProps } from 'styled-system'
import styled from 'styled-components'
import Box from '../Box'

const Grid = styled(Box)<GridProps>`
  ${grid}
`
Grid.defaultProps = {
  display: 'grid',
}
export default Grid
