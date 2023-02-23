import React from 'react'
import styled from 'styled-components'
import { Menu, Dropdown } from 'antd'
import { useModalContext } from './Modal/ModalContext'
import Logo from './Logo'
import { MultiSelect, MultiSelectItem } from './MultiSelect'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { actions as appActions } from '../features/app/app-slice'
import { actions as positionActions } from '../features/position/position-slice'
import MenuDropdown from '../assets/images/menu-dropdown.svg'
import StartOverIcon from '../assets/images/start-over-icon.svg'
import StartOverIconGrey from '../assets/images/start-over-icon-grey.svg'
import { media } from '../utils/media'
import { spacingIncrement } from '../features/app/themes'

const StartOverButton = styled.div`
  align-items: center;
  background-color: ${({ theme }): string => theme.colors.foreground};
  border: 1px ${({ theme }): string => theme.colors.accent} solid;
  border-radius: 0.5rem;
  color: ${({ theme }): string => theme.colors.subtitle};
  cursor: pointer;
  display: flex;
  font-size: 1.0625rem;
  height: 2.25rem;
  justify-content: center;
  margin-left: ${spacingIncrement(3)};
  padding: 1rem;
`

const StyledMultiSelect = styled(MultiSelect)`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  height: 1.75rem;
  padding: 0;
  width: auto;
`

const DesktopRhsWrapper = styled.div`
  align-items: center;
  display: flex;

  ${media.lg`
    display: none;
  `}
`

const MobileMenu = styled.div`
  display: none;

  ${media.lg`
    display: block;
  `}
`

const StyledMenu = styled(Menu)`
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  font-size: 0.9375rem;
  padding: ${spacingIncrement(1.5)};
`

const StartOverText = styled.span`
  color: ${({ theme }): string => theme.colors.loss};
`

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
`

const ToggleText = styled.span`
  color: ${({ theme }): string => theme.colors.subtitle};
  margin-left: ${spacingIncrement(1)};

  ${media.lg`
    margin-left: 0;
    margin-right: ${spacingIncrement(2)};
  `}
`

const ToggleMenuItem = styled.div`
  padding: 5px 12px;
`

const MenuBreak = styled.div`
  background-color: ${({ theme }): string => theme.colors.buttonLight} !important;
  height: 1px;
  margin: ${spacingIncrement(1)} 0;
  width: 100%;
`

const Header: React.FC = () => {
  const dispatch = useAppDispatch()
  const mode = useAppSelector((state) => state.position.ui.mode)
  const { setShowModal } = useModalContext()

  const startOver = (): void => {
    if (dispatch(appActions.stepChanged(0))) {
      dispatch(appActions.startOver(true))
      setShowModal(true)
    }
  }

  const AdvancedToggle = (
    <StyledMultiSelect selectedKey={mode}>
      <MultiSelectItem
        onClick={(): void => {
          dispatch(positionActions.modeChanged('basic'))
          dispatch(positionActions.holdingPeriodUnitChanged('Y'))
          dispatch(positionActions.holdingPeriodNumChanged(1))
        }}
        itemKey="basic"
      >
        Off
      </MultiSelectItem>
      <MultiSelectItem
        onClick={(): void => {
          dispatch(positionActions.modeChanged('advanced'))
        }}
        itemKey="advanced"
      >
        On
      </MultiSelectItem>
    </StyledMultiSelect>
  )

  const menu = (
    <StyledMenu>
      <ToggleMenuItem>
        <ToggleText>Advanced Parameters</ToggleText>
        {AdvancedToggle}
      </ToggleMenuItem>
      <MenuBreak />
      <Menu.Item onClick={startOver} key={3}>
        <StartOverText style={{ marginRight: '0.5rem' }}>Start over</StartOverText>
        <img src={StartOverIcon} style={{ height: '1.25rem' }} alt="start over icon" />
      </Menu.Item>
    </StyledMenu>
  )

  return (
    <Wrapper>
      <Logo width="223.049" height="35.217" />
      <DesktopRhsWrapper>
        {AdvancedToggle}
        <ToggleText>Advanced</ToggleText>
        <StartOverButton onClick={startOver}>
          Start over{' '}
          <img src={StartOverIconGrey} style={{ height: '1.25rem' }} alt="start over icon grey" />
        </StartOverButton>
      </DesktopRhsWrapper>
      <MobileMenu>
        <Dropdown overlay={menu}>
          <img src={MenuDropdown} style={{ height: '2rem' }} alt="menu dropdown icon" />
        </Dropdown>
      </MobileMenu>
    </Wrapper>
  )
}

export default Header
