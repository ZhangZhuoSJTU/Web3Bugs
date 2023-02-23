import { animated, useSpring } from 'react-spring'
import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

type TabProps = {
  active: boolean
  label: string
  index: number
  onChange: (index: number) => void
  onActiveChanged: (element: HTMLDivElement) => void
}

type OptionProps = {
  label: string
  component: React.ReactNode
}
type TabsProps = {
  // index of currentTab, default to 0
  currentTab?: number
  options: OptionProps[]
  onChange?: (index: number) => unknown
}

const Tab: React.FC<TabProps> = ({ active, index, label, onActiveChanged, onChange }) => {
  const ref = useRef<HTMLDivElement>(null)

  const handleChange = (): void => {
    onChange(index)
  }

  useEffect(() => {
    if (active && ref.current) {
      onActiveChanged(ref.current)
    }
  }, [active, onActiveChanged])

  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      onKeyPress={handleChange}
      onClick={handleChange}
      ref={ref}
      className="mb-[10px] ml-8 first:ml-0 focus:outline-none md:ml-11 lg:mb-5 lg:ml-20"
    >
      <span
        className={`text-sm font-semibold sm:text-xl lg:text-2xl cursor-pointer hover:text-title ${
          active ? 'text-title' : 'text-[#7C89A0]'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

const Tabs: React.FC<TabsProps> = ({ currentTab, options, onChange }) => {
  const [activeTab, setActiveTab] = useState(currentTab || 0)
  const [activeTabElement, setActiveTabElement] = useState<HTMLDivElement | null>(null)
  const [style, api] = useSpring(() => ({ left: 0, width: 0 }))
  const handleChange = (index: number): void => {
    setActiveTab(index)
    if (onChange) {
      onChange(index)
    }
  }

  const handleActiveChanged = (element: HTMLDivElement): void => {
    setActiveTabElement(element)
  }

  const refContent = useRef<HTMLDivElement>(null)
  const handleResize = useCallback(() => {
    const content = refContent.current as HTMLDivElement
    if (content) {
      // set content's height to prevent below elements to jump on tab change
      const maxTabHeight = Math.max(...Array.from(content.children).map((c) => c.clientHeight))
      content.style.minHeight = `${maxTabHeight}px`
    }

    if (activeTabElement) {
      api.start({ left: activeTabElement.offsetLeft, width: activeTabElement.clientWidth })
    }
  }, [activeTabElement, api])

  useEffect(() => {
    // update ink position on render
    handleResize()
    // handle ink position on window resize (there's a buggy behaviour on first time inspecting browser)
    window.addEventListener('resize', handleResize)
    return (): void => {
      window.removeEventListener('resize', handleResize)
    }
  }, [handleResize])

  return (
    <div role="tablist" className="w-full">
      {/* Tabs pane */}
      <div className="flex relative flex-col items-center">
        <div className="flex relative flex-auto justify-center self-stretch">
          <div className="flex overflow-x-scroll relative px-4 scrollbar-hide">
            {options.map(({ label }, index) => (
              <Tab
                onActiveChanged={handleActiveChanged}
                onChange={handleChange}
                active={activeTab === index}
                label={label}
                index={index}
                key={label}
              />
            ))}
            <animated.div className="absolute bottom-0 h-[4px] bg-prepo lg:h-[6px]" style={style} />
          </div>
        </div>
        <div className="top-full left-0 w-full h-[2px] bg-prepo opacity-[0.06]" />
      </div>
      {/* active tab content */}
      <div ref={refContent} className="relative min-h-max">
        {options.map(({ label, component }, index) => (
          <div key={label} className={clsx('absolute top-0 w-full', index === activeTab && 'z-10')}>
            <div
              key={`label-${activeTab}`}
              className={` ${index === activeTab ? 'visible' : 'invisible'} overflow-hidden flex`}
            >
              {component}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Tabs
