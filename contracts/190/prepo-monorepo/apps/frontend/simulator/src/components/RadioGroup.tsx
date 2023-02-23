import React, { forwardRef, Ref } from 'react'
import { Radio, RadioGroupProps } from 'antd'
import styled from 'styled-components'
import { spacingIncrement } from '../features/app/themes'

type Props = RadioGroupProps & {
  ref?: Ref<HTMLDivElement> | undefined
  label?: string
  disabled?: boolean
  noBorder?: boolean
  childRadioGroup?: React.ReactNode
}

const RadioWrapper = styled(Radio.Group)<Props>`
  border: 1px solid ${({ theme }): string => theme.colors.accent};
  border-radius: 1rem;
  display: ${({ childRadioGroup }): string => (childRadioGroup ? 'block' : 'flex')};
  margin: 0;
  margin-bottom: ${spacingIncrement(2)};
  opacity: ${({ disabled }): string => (disabled ? '0.7' : '1')};
  padding: 0.5rem;
  transition: all 0.1s;
  transition-timing-function: ease;
  white-space: nowrap;

  ${({ theme, value, disabled, noBorder }): string => {
    // Used for the childRadioGroup
    if (noBorder) {
      return 'border: none; padding: 0; margin: 0;'
    }

    if (value || disabled) {
      return `border: 1px solid ${theme.colors.accentLight};`
    }
    return `border: 2px solid ${theme.colors.primary};`
  }}

  .ant-radio-wrapper {
    background-color: ${({ theme }): string => theme.colors.background};
    border: 1px solid ${({ theme }): string => theme.colors.accentLight};
    /* Stop height glitching when border gets 1px larger by adding 1px to padding when not checked */
    border-radius: 0.5rem;
    padding: calc(0.75rem + 1px);
  }

  .ant-radio-wrapper-checked {
    border: 2px solid ${({ theme }): string => theme.colors.textPrimary};
    font-weight: 800;
    padding: 0.75rem;
  }

  .ant-radio-checked .ant-radio-inner:focus {
    border-color: ${({ theme }): string => theme.colors.primary};
  }
  .ant-radio-checked .ant-radio-inner {
    border-color: ${({ theme }): string => theme.colors.primary};
  }
  .ant-radio-checked .ant-radio-inner:after {
    background-color: ${({ theme }): string => theme.colors.primary};
  }
  .ant-radio:hover .ant-radio-inner {
    border-color: ${({ theme }): string => theme.colors.primary};
  }

  .ant-radio-wrapper-checked {
    background-color: ${({ theme }): string => theme.colors.foreground};
  }

  > label {
    flex-grow: 1;
    margin: 0;
    margin-right: 0.5rem;
    width: 100%;

    &:last-child {
      margin-right: 0;
    }
  }

  width: 100%;
`

const Label = styled.div<{ disabled?: boolean }>`
  font-weight: bold;
  margin-bottom: 0.2rem;
  opacity: ${({ disabled }): string => (disabled ? '0.3' : '1')};
`

const SpecialChildrenWrapper = styled.div`
  display: flex;

  > label {
    flex-grow: 1;
    margin: 0;
    margin-right: 0.5rem;
    width: 100%;

    &:last-child {
      margin-right: 0;
    }
  }
`

const RadioGroup: React.FC<Props> = forwardRef(
  (
    { label, disabled, value, childRadioGroup, noBorder = false, children, ...props },
    ref: Ref<HTMLDivElement> | undefined
  ) => {
    const renderChildRadioGroup = (): JSX.Element | null => {
      if (!childRadioGroup) {
        return null
      }

      return (
        <>
          <hr style={{ margin: '0.5rem' }} />
          {childRadioGroup}
        </>
      )
    }

    const renderChildren = (): React.ReactNode => {
      if (!childRadioGroup) {
        return children
      }

      return <SpecialChildrenWrapper>{children}</SpecialChildrenWrapper>
    }

    return (
      <>
        <Label disabled={disabled}>{label}</Label>
        <RadioWrapper
          ref={ref}
          noBorder={noBorder}
          childRadioGroup={childRadioGroup}
          disabled={disabled}
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          value={value}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...props}
        >
          {renderChildren()}
          {renderChildRadioGroup()}
        </RadioWrapper>
      </>
    )
  }
)

RadioGroup.displayName = 'RadioGroup'

export default RadioGroup
