import { GasSpeed } from 'prepo-constants'
import { spacingIncrement, Slider, Button, SliderValue, media } from 'prepo-ui'
import { useState } from 'react'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { Input, RadioChangeEvent } from 'antd'
import CollapsibleItem, { Title } from './CollapsibleItem'
import { SLIPPAGE_SETTINGS } from './AdvancedSettingsStore'
import Modal from '../Modal'
import Radio from '../Radio'
import RadioGroup from '../RadioGroup'
import { useRootStore } from '../../context/RootStoreProvider'
import useResponsive from '../../hooks/useResponsive'
import { numberFormatter } from '../../utils/numberFormatter'

const { percent } = numberFormatter

const Wrapper = styled.div``

type MaxSlippageTitleProps = {
  slippage?: number
}

const TitleWrapper = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding-right: ${spacingIncrement(10)};
  width: 100%;
`

const MaxSlippageTitle: React.FC<MaxSlippageTitleProps> = ({ slippage = 0 }) => (
  <TitleWrapper>
    <Title>Max Slippage</Title>
    <Title>{percent(slippage)}</Title>
  </TitleWrapper>
)

type GasPriceTitleProps = {
  secondaryTitle: string
}

const GasPriceTitle: React.FC<GasPriceTitleProps> = ({ secondaryTitle = 0 }) => (
  <TitleWrapper>
    <Title>Gas Price</Title>
    <Title>{secondaryTitle}</Title>
  </TitleWrapper>
)

const SliderWrapper = styled.div`
  padding: ${spacingIncrement(10)} ${spacingIncrement(5)};
`

const GasPriceSelectionWrapper = styled(RadioGroup)`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(10)} 0;
  justify-content: center;
  padding-top: ${spacingIncrement(10)};
`

const SingleGasPriceSelectionWrapper = styled.div`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  padding: ${spacingIncrement(5)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const GasPriceValue = styled.div`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  position: absolute;
  right: ${spacingIncrement(20)};
  top: ${spacingIncrement(17)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const CustomInput = styled(Input)`
  background-color: ${({ theme }): string => theme.color.primaryAccent};
  border: none;
  box-shadow: none;
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  max-width: ${spacingIncrement(63)};
  padding: ${spacingIncrement(3)} ${spacingIncrement(6)};
  text-align: center;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const ButtonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(10)};
  padding-top: ${spacingIncrement(10)};
`

const AdvancedSettingsModal: React.FC = () => {
  const { advancedSettingsStore, gasStore } = useRootStore()
  const {
    closeModal,
    customGasPrice,
    gasPrice,
    gasSpeed,
    invalidCustomGas,
    isSettingsOpen,
    onChangeCustomGasPrice,
    resetValues,
    saveSettings,
    setUnsavedSlippage,
    setUnsavedGasSpeed,
    slippage,
  } = advancedSettingsStore
  const { gasPriceOptionsNumber } = gasStore
  const { isPhone } = useResponsive()
  const [gasPriceCollapsed, setGasPriceCollapsed] = useState(true)

  const onSelectGasSpeed = (e: RadioChangeEvent): void => {
    setUnsavedGasSpeed(e.target.value)
  }

  const onChangeSlippage = (value: SliderValue): void => {
    if (typeof value === 'number') setUnsavedSlippage(value)
  }

  return (
    <Modal
      bottom={isPhone}
      centered={gasPriceCollapsed}
      footer={null}
      onCancel={closeModal}
      title="Advanced Settings"
      visible={isSettingsOpen}
    >
      <Wrapper>
        <MaxSlippageTitle slippage={slippage} />
        <SliderWrapper>
          <Slider
            labelSpacing="normal"
            value={slippage}
            min={SLIPPAGE_SETTINGS.MINIMUM_SLIPPAGE}
            max={SLIPPAGE_SETTINGS.MAXIMUM_SLIPPAGE}
            step={0.001}
            onChange={onChangeSlippage}
            trackColor="primary"
            trackUnderlyingColor="neutral7"
            labelPosition="none"
            thumbStyles={['circle', 'circle']}
            thickness="small"
          />
        </SliderWrapper>
        <CollapsibleItem
          title={<GasPriceTitle secondaryTitle={`${gasSpeed} (${gasPrice} Gwei)`} />}
          onChange={(collapsed): void => setGasPriceCollapsed(collapsed)}
          description={
            <GasPriceSelectionWrapper value={gasSpeed} onChange={onSelectGasSpeed}>
              {Object.entries(gasPriceOptionsNumber).map(([speed, price]) => (
                <Radio backgroundColor="neutral10" key={speed} value={speed}>
                  <SingleGasPriceSelectionWrapper>{speed}</SingleGasPriceSelectionWrapper>
                  <GasPriceValue>
                    {speed === GasSpeed.CUSTOM ? (
                      <CustomInput value={customGasPrice} onChange={onChangeCustomGasPrice} />
                    ) : (
                      price
                    )}
                    &nbsp;Gwei
                  </GasPriceValue>
                </Radio>
              ))}
            </GasPriceSelectionWrapper>
          }
        />
        <ButtonWrapper>
          <Button block disabled={invalidCustomGas} type="primary" onClick={saveSettings}>
            {invalidCustomGas ? 'Gas price must be larger than 0' : 'Save'}
          </Button>
          <Button block type="text" onClick={resetValues}>
            Reset
          </Button>
        </ButtonWrapper>
      </Wrapper>
    </Modal>
  )
}

export default observer(AdvancedSettingsModal)
