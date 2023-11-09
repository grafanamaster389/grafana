import React, { HTMLAttributes } from 'react';

import { textUtil } from '@grafana/data';
import { Icon, Stack, Text } from '@grafana/ui';

interface Props extends HTMLAttributes<HTMLAnchorElement> {
  href: string;
  external?: boolean;
  size?: 'md' | 'sm';
}

const Link = ({ children, href, size = 'md', external = false, ...rest }: Props) => {
  const externalProps = external ? { target: '_blank', rel: 'noreferrer' } : {};
  const small = size === 'sm';

  return (
    <a href={textUtil.sanitizeUrl(href)} {...externalProps} {...rest}>
      <Text color="link" variant={small ? 'bodySmall' : 'body'}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {children} {external && <Icon size={small ? 'xs' : 'sm'} name="external-link-alt" />}
        </Stack>
      </Text>
    </a>
  );
};

export { Link };
