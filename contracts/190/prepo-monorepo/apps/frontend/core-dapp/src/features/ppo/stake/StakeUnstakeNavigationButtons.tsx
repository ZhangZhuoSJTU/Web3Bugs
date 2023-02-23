import { Trans } from '@lingui/macro'
import { spacingIncrement, media, Button, ButtonColors } from 'prepo-ui'
import styled from 'styled-components'
import { lightPurpleButtonStyles } from '../ppo-button-styles'

const Wrapper = styled.div`
  display: flex;
  gap: ${spacingIncrement(12)};
  > * {
    font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
    flex: 1;
    height: ${spacingIncrement(38)};
    margin-bottom: ${spacingIncrement(16)};
    transition: font-weight 0.2s;
    ${media.desktop`
      height: ${spacingIncrement(48)};
    `}
  }
  > *:hover {
    font-weight: ${({ theme }): number => theme.fontWeight.bold};
  }
`

export const customStyles: ButtonColors = {
  ...lightPurpleButtonStyles,
  border: 'accentPrimary',
  hoverBorder: 'accentPrimary',
}

const StakeUnstakeNavigationButtons: React.FC<{
  isStake: boolean
  onTabChange: (tab: 'stake' | 'unstake') => void
}> = ({ isStake, onTabChange }) => (
  <Wrapper>
    <Button
      block
      customColors={!isStake ? customStyles : undefined}
      type={isStake ? 'primary' : undefined}
      onClick={(): void => onTabChange('stake')}
    >
      <Trans>Stake</Trans>
    </Button>
    <Button
      block
      customColors={isStake ? customStyles : undefined}
      type={!isStake ? 'primary' : undefined}
      onClick={(): void => onTabChange('unstake')}
    >
      <Trans>Unstake</Trans>
    </Button>
  </Wrapper>
)

export default StakeUnstakeNavigationButtons
