import { ROUTES } from '../../lib/constants'
import { Button } from '../Button'

const Banner: React.FC = () => (
  <div className="py-[6px] px-2 text-white bg-prepo">
    <p className="text-center leading-4">
      The PPO Token Public Sale has started!{' '}
      <Button
        className="underline cursor-pointer !p-0 font-normal text-base hover:!bg-transparent leading-4"
        iconClassName="!ml-1"
        href={ROUTES.TOKEN_SALE}
        target="_blank"
        iconSize={16}
      >
        Join now
      </Button>
    </p>
  </div>
)

export default Banner
