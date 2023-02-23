import styled from 'styled-components'
import { spacingIncrement } from 'prepo-ui'
import { Trans } from '@lingui/macro'
import { buyPageItems } from './buyPageItems'
import { ButtonGrid, ButtonGridStyles } from '../ButtonGrid'
import PageTitle from '../PageTitle'
import { IconSizeResponsive } from '../../../types/general.types'

const Grid = styled(ButtonGrid)`
  margin-top: ${spacingIncrement(48)};
`

const buttonsCustomStyles: ButtonGridStyles = {
  background: 'neutral9',
  label: 'neutral5',
  hoverBackground: 'accentPrimary',
  hoverLabel: 'primary',
  borderColor: 'neutral6',
  fontColor: 'accent3',
  iconStyles: {
    desktop: {
      top: spacingIncrement(20),
      left: spacingIncrement(30),
    },
  },
  fontSize: {
    desktop: 'lg',
    mobile: 'base',
  },
  fontWeight: {
    desktop: 'medium',
    mobile: 'regular',
  },
}

const iconSize: IconSizeResponsive = {
  desktop: 38,
  mobile: 24,
}

const externalIconSize: IconSizeResponsive = {
  desktop: 18,
  mobile: 15,
}

const BuyPage: React.FC = () => (
  <>
    <PageTitle>
      <Trans>Buy PPO</Trans>
    </PageTitle>
    <Grid
      items={buyPageItems}
      customStyles={buttonsCustomStyles}
      iconSize={iconSize}
      externalIconSize={externalIconSize}
      alignExternalIcon="right"
    />
  </>
)

export default BuyPage
