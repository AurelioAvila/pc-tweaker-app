//! Connectivity guard for the two tweaks that change how TCP behaves.
//!
//! `netlatency` and `netshaper` are the only changes here whose effect is not
//! confined to this machine: they alter how Windows talks to everything else,
//! and on an unusual line — a middlebox that dislikes BBR2's pacing, a driver
//! that mishandles `TcpAckFrequency` — the outcome genuinely cannot be read
//! off the setting. Disclosure text does not fix that, because the user
//! cannot check the claim either.
//!
//! What *can* be checked is the case that actually costs something: a line
//! that worked a second ago and does not work now. That is not a judgement
//! call, so the apply funnel notices it, puts the setting back on its own and
//! says so, instead of leaving someone to work out which of the things they
//! just ticked took their connection away.
//!
//! Deliberately not measured: throughput or round-trip time, before against
//! after. Congestion control only shows itself on a loaded line; an idle
//! probe would move by noise alone, and reporting noise as evidence is the
//! move this app exists to refuse.

use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

/// Endpoints the app already reaches for in normal operation: 1.1.1.1 is what
/// the DNS tweak writes, github.com is where the updater looks. The literal
/// address comes first so an online machine answers in milliseconds and never
/// waits on a resolver; the hostname is the fallback for networks that block
/// Cloudflare, and doubles as a check that name resolution still works.
const PROBES: [&str; 2] = ["1.1.1.1:443", "github.com:443"];

/// Short on purpose. This runs before and after an apply the user is waiting
/// on, and a machine that is simply offline must not be held up for it.
const TIMEOUT: Duration = Duration::from_secs(2);

/// Whether this tweak changes how the TCP stack behaves, and so is worth
/// guarding. Nothing else here can take the line down.
pub fn relevant(id: &str) -> bool {
    id == crate::netlatency::TWEAK_ID || id == crate::netshaper::TWEAK_ID
}

/// One pass over the probes. A single reachable endpoint is enough: this asks
/// "does the line still work", not "is every host on the internet up".
pub fn online() -> bool {
    PROBES.iter().any(|probe| {
        probe.to_socket_addrs().is_ok_and(|addrs| {
            addrs
                .take(4)
                .any(|addr| TcpStream::connect_timeout(&addr, TIMEOUT).is_ok())
        })
    })
}

/// True only when the line was up before the change and is still down on a
/// second look.
///
/// The second look is what stops a Wi-Fi blip from reverting a setting that
/// was never the problem. `was_online == false` short-circuits before any
/// socket is opened, so a machine with no internet is never told it just lost
/// some — and never has a tweak pulled out from under it on that basis.
pub fn regressed(was_online: bool) -> bool {
    if !was_online || online() {
        return false;
    }
    std::thread::sleep(Duration::from_millis(500));
    !online()
}

/// What the user is told when the guard fires. The apply is reported as
/// failed, because from where they sit it did fail: they asked for a faster
/// line and have the one they started with.
pub fn reverted_message(restored: bool) -> String {
    if restored {
        "the connection stopped responding after this change, so it was put back exactly as it was"
            .to_string()
    } else {
        "the connection stopped responding after this change and putting it back failed - use Restore All"
            .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The guard must never open a socket, nor revert anything, on a machine
    /// that had no connectivity to lose. This is the entire reason
    /// `regressed` takes the earlier reading instead of deciding alone.
    #[test]
    fn a_machine_that_was_offline_is_never_reported_as_regressed() {
        assert!(!regressed(false));
    }

    /// Guarding anything else would mean two extra network round trips on
    /// tweaks that cannot affect the network at all.
    #[test]
    fn only_the_two_tcp_tweaks_are_guarded() {
        assert!(relevant(crate::netlatency::TWEAK_ID));
        assert!(relevant(crate::netshaper::TWEAK_ID));
        assert!(!relevant(crate::dns::TWEAK_ID));
        assert!(!relevant("power_plan"));
    }
}
